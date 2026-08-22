#!/usr/bin/env python3
"""
将同一可变字体的多个 Unicode 子集切片(ttf)合并为一个完整可变字体。
保留:可变轴 fvar/gvar/avar/STAT/HVAR/MVAR、OpenType 特性 GSUB/GPOS/GDEF(含 VarStore)。
合并要点:
  * 字形以 glyph name 为键合并(glyf/loca/gvar/hmtx/cmap)
  * GSUB/GPOS: lookup 按序列化内容去重, feature/script 聚合
  * GDEF VarStore: 按 outer index 拼接 items, 重映射 GPOS 中 VariationIndex 的 inner
  * HVAR VarStore: 同样处理, 并重映射 AdvWidthMap 的 varIdx
"""
import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import otTables as ot


# ------------------------------------------------------------------ VarStore
def merge_varstore(vs_list):
    """合并多个 VarStore(region 结构一致)为新的 VarStore。
    返回 (new_vs, offset_map) offset_map[fontIdx][outerIdx] = inner 偏移
    """
    assert vs_list
    ref = vs_list[0]
    new_vs = ot.VarStore()
    new_vs.Format = ref.Format
    new_vs.VarRegionList = ref.VarRegionList
    n_outer = len(ref.VarData)
    new_vs.VarData = []
    offset_map = []
    for oi in range(n_outer):
        # 收集所有字体该 outer 的 items
        parts = []
        offsets = []
        acc = 0
        for vs in vs_list:
            vd = vs.VarData[oi]
            offsets.append(acc)
            parts.append(list(vd.Item))
            acc += len(vd.Item)
        offset_map.append(offsets)
        # 检查 region 索引一致
        ref_ri = vs_list[0].VarData[oi].VarRegionIndex
        for vs in vs_list[1:]:
            assert list(vs.VarData[oi].VarRegionIndex) == list(ref_ri), \
                f"VarRegionIndex mismatch at outer {oi}"
        items = []
        for p in parts:
            items.extend(p)
        # 计算 NumShorts: 全部值是否都能用有符号短整型
        n_regions = len(ref_ri)
        all_shorts = all(
            all(isinstance(x, int) and -32768 <= x <= 32767 for x in item)
            for item in items
        )
        vd = ot.VarData()
        vd.Item = items
        vd.ItemCount = len(items)
        vd.VarRegionIndex = list(ref_ri)
        vd.VarRegionCount = len(ref_ri)
        vd.NumShorts = n_regions if all_shorts else 0
        new_vs.VarData.append(vd)
    # offset_map: [outerIdx][fontIdx] = offset
    # 转成 [fontIdx][outerIdx]
    per_font = []
    n_fonts = len(vs_list)
    for fi in range(n_fonts):
        row = {}
        for oi in range(n_outer):
            row[oi] = offset_map[oi][fi]
        per_font.append(row)
    return new_vs, per_font


def remap_gpos_devices(font, offset):
    """重映射 font 的 GPOS 中所有 VariationIndex device 表的 inner index。
    offset: {outerIdx: innerOffset}
    """
    count = 0
    if 'GPOS' not in font:
        return 0
    gpos = font['GPOS'].table
    for lookup in gpos.LookupList.Lookup:
        for st in lookup.SubTable:
            anchors = []
            if hasattr(st, 'MarkArray') and st.MarkArray:
                for mr in st.MarkArray.MarkRecord:
                    anchors.append(mr.MarkAnchor)
            if hasattr(st, 'BaseArray') and st.BaseArray:
                for br in st.BaseArray.BaseRecord:
                    anchors.extend(br.BaseAnchor)
            if hasattr(st, 'Mark1Array') and st.Mark1Array:
                for mr in st.Mark1Array.MarkRecord:
                    anchors.append(mr.MarkAnchor)
            if hasattr(st, 'Mark2Array') and st.Mark2Array:
                for mr2 in st.Mark2Array.Mark2Record:
                    anchors.extend(mr2.Mark2Anchor)
            if hasattr(st, 'LigatureArray') and st.LigatureArray:
                for la in st.LigatureArray.LigatureAttach:
                    for c in la.ComponentRecord:
                        anchors.append(c.LigGlyph)
            for a in anchors:
                if a is None:
                    continue
                for attr in ('XDeviceTable', 'YDeviceTable'):
                    d = getattr(a, attr, None)
                    if d is not None and getattr(d, 'DeltaFormat', 0) == 0x8000:
                        outer = d.StartSize
                        off = offset.get(outer, 0)
                        if off:
                            d.EndSize += off
                            count += 1
    return count


# ------------------------------------------------------------------ layout
def lookup_signature(lookup):
    import io
    from fontTools.misc.xmlWriter import XMLWriter
    buf = io.StringIO()
    w = XMLWriter(buf)
    lookup.toXML(w, None)
    return buf.getvalue()


def merge_layout(fonts, tag, pre_remap=None):
    """合并 GSUB/GPOS。
    pre_remap: 可选, 若提供, 为每字体就地重映射 device(用于 GPOS)。
    返回新的 otTables 表对象。
    """
    # 1) 收集所有 lookup, 按签名去重
    sig_to_obj = {}
    ordered_lookups = []       # 新 lookup 列表
    old_to_new = []            # per font: old idx -> new idx
    for fi, f in enumerate(fonts):
        table = f[tag].table
        mapping = {}
        for oi, lu in enumerate(table.LookupList.Lookup):
            sig = lookup_signature(lu)
            if sig in sig_to_obj:
                mapping[oi] = sig_to_obj[sig]
            else:
                idx = len(ordered_lookups)
                ordered_lookups.append(lu)
                sig_to_obj[sig] = idx
                mapping[oi] = idx
        old_to_new.append(mapping)

    # 2) 聚合 features: (script, langsys) -> featureTags; featureTag -> [new lookup idx]
    # 简单策略: 对每个 script, 默认 langsys 的 feature 并集; feature 的 lookup 并集
    script_features = {}   # scriptTag -> (set(featureTags), {langsysTag: set(featureTags)})
    feature_lookups = {}   # featureTag -> set(new lookup idx)
    for fi, f in enumerate(fonts):
        table = f[tag].table
        # feature records
        tag_to_feature = {}
        for rec in table.FeatureList.FeatureRecord:
            tag_to_feature[rec.FeatureTag] = rec.Feature
        # script records
        for sr in table.ScriptList.ScriptRecord:
            stag = sr.ScriptTag
            dft = set()
            langs = {}
            script = sr.Script
            if script.DefaultLangSys:
                for fi2 in script.DefaultLangSys.FeatureIndex:
                    fname = table.FeatureList.FeatureRecord[fi2].FeatureTag
                    dft.add(fname)
            if script.LangSysRecord:
                for lr in script.LangSysRecord:
                    ts = set()
                    for fi2 in lr.LangSys.FeatureIndex:
                        fname = table.FeatureList.FeatureRecord[fi2].FeatureTag
                        ts.add(fname)
                    langs[lr.LangSysTag] = ts
            if stag in script_features:
                d, l = script_features[stag]
                d.update(dft)
                for k, v in langs.items():
                    l.setdefault(k, set()).update(v)
            else:
                script_features[stag] = (dft, langs)
        # features -> lookups
        for fname, feat in tag_to_feature.items():
            s = feature_lookups.setdefault(fname, set())
            for oi in feat.LookupListIndex:
                s.add(old_to_new[fi][oi])

    # 3) 构建新表
    # LookupList
    ll = ot.LookupList()
    ll.Lookup = ordered_lookups
    ll.LookupCount = len(ordered_lookups)
    # FeatureList
    fl = ot.FeatureList()
    fl.FeatureRecord = []
    feat_index = {}
    for fname in sorted(feature_lookups.keys()):
        rec = ot.FeatureRecord()
        rec.FeatureTag = fname
        feat = ot.Feature()
        feat.LookupListIndex = sorted(feature_lookups[fname])
        feat.LookupCount = len(feat.LookupListIndex)
        rec.Feature = feat
        fl.FeatureRecord.append(rec)
        feat_index[fname] = len(fl.FeatureRecord) - 1
    fl.FeatureCount = len(fl.FeatureRecord)
    # ScriptList
    sl = ot.ScriptList()
    sl.ScriptRecord = []
    for stag in sorted(script_features.keys()):
        dft, langs = script_features[stag]
        sr = ot.ScriptRecord()
        sr.ScriptTag = stag
        script = ot.Script()
        if dft:
            ls = ot.LangSys()
            ls.FeatureIndex = sorted(feat_index[t] for t in dft)
            ls.FeatureCount = len(ls.FeatureIndex)
            ls.ReqFeatureIndex = 0xFFFF
            ls.LookupOrder = None
            script.DefaultLangSys = ls
        else:
            script.DefaultLangSys = None
        script.LangSysRecord = []
        for ltag in sorted(langs.keys()):
            lr = ot.LangSysRecord()
            lr.LangSysTag = ltag
            ls = ot.LangSys()
            ls.FeatureIndex = sorted(feat_index[t] for t in langs[ltag])
            ls.FeatureCount = len(ls.FeatureIndex)
            ls.ReqFeatureIndex = 0xFFFF
            ls.LookupOrder = None
            lr.LangSys = ls
            script.LangSysRecord.append(lr)
        script.LangSysCount = len(script.LangSysRecord)
        sr.Script = script
        sl.ScriptRecord.append(sr)
    sl.ScriptCount = len(sl.ScriptRecord)
    return sl, fl, ll


# ------------------------------------------------------------------ glyph merge
def merge_glyphs(fonts, out):
    order = []
    seen = set()
    for f in fonts:
        for g in f.getGlyphOrder():
            if g not in seen:
                seen.add(g)
                order.append(g)
    out.setGlyphOrder(order)
    glyf = out['glyf']
    glyf.glyphs = {}
    for name in order:
        for f in fonts:
            if name in f.getGlyphOrder():
                glyf.glyphs[name] = f['glyf'].glyphs[name]
                break
    out['hmtx'].metrics = {}
    for name in order:
        for f in fonts:
            if name in f.getGlyphOrder():
                out['hmtx'].metrics[name] = f['hmtx'].metrics[name]
                break
    out['gvar'].variations = {}
    for name in order:
        for f in fonts:
            if 'gvar' in f and name in f['gvar'].variations:
                out['gvar'].variations[name] = f['gvar'].variations[name]
                break
    # cmap 合并
    merged = {}
    for f in fonts:
        best = f.getBestCmap()
        for cp, name in best.items():
            merged.setdefault(cp, name)
    cmap = out['cmap']
    cmap.tables = []
    from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
    t4 = CmapSubtable.getSubtableClass(4)(4)
    t4.platformID, t4.platEncID, t4.language = 3, 1, 0
    t4.cmap = {cp: n for cp, n in merged.items() if cp <= 0xFFFF}
    t12 = CmapSubtable.getSubtableClass(12)(12)
    t12.platformID, t12.platEncID, t12.language = 3, 10, 0
    t12.cmap = dict(merged)
    cmap.tables = [t4, t12]
    cmap.tableVersion = 0


# ------------------------------------------------------------------ main
def main():
    inputs = sys.argv[1:-1]
    output = sys.argv[-1]
    fonts = [TTFont(p) for p in inputs]
    assert 'fvar' in fonts[0], "not a variable font"

    out = TTFont()
    for tag in ('head', 'hhea', 'maxp', 'OS/2', 'name', 'post', 'gasp',
                'fvar', 'avar', 'STAT', 'MVAR'):
        if tag in fonts[0]:
            out[tag] = fonts[0][tag]
    for tag in ('glyf', 'loca', 'hmtx', 'cmap', 'gvar'):
        out[tag] = newTable(tag)
    merge_glyphs(fonts, out)

    # ---- GDEF (先合并 VarStore, 再做 GPOS device 重映射) ----
    vs_fonts = [(i, f) for i, f in enumerate(fonts)
                if f.get('GDEF') and f['GDEF'].table and getattr(f['GDEF'].table, 'VarStore', None)]
    offset_map = None
    if vs_fonts:
        vs_list = [f['GDEF'].table.VarStore for _, f in vs_fonts]
        new_vs, per_font = merge_varstore(vs_list)
        offset_map = {fi: per_font[pi] for pi, (fi, _) in enumerate(vs_fonts)}
        gdef = newTable('GDEF')
        gdef.table = ot.GDEF()
        t = gdef.table
        t.Version = 0x00010003
        # GlyphClassDef 按名字合并
        gclass = {}
        for f in fonts:
            if not (f.get('GDEF') and f['GDEF'].table):
                continue
            gdt = f['GDEF'].table
            if getattr(gdt, 'GlyphClassDef', None):
                for g, c in gdt.GlyphClassDef.classDefs.items():
                    gclass.setdefault(g, c)
        if gclass:
            cd = ot.ClassDef()
            cd.classDefs = gclass
            t.GlyphClassDef = cd
        else:
            t.GlyphClassDef = None
        # MarkGlyphSetsDef
        marksets = []
        for f in fonts:
            if not (f.get('GDEF') and f['GDEF'].table):
                continue
            mgsd = getattr(f['GDEF'].table, 'MarkGlyphSetsDef', None)
            if mgsd:
                for cov in mgsd.Coverage:
                    marksets.append(list(cov.glyphs))
        if marksets:
            m = ot.MarkGlyphSetsDef()
            m.MarkSetTableFormat = 1
            covs = []
            for gs in marksets:
                cov = ot.Coverage()
                cov.glyphs = gs
                covs.append(cov)
            m.Coverage = covs
            m.MarkSetCount = len(covs)
            t.MarkGlyphSetsDef = m
        else:
            t.MarkGlyphSetsDef = None
        t.AttachList = None
        t.LigCaretList = None
        t.MarkAttachClassDef = None
        t.VarStore = new_vs
        out['GDEF'] = gdef
    else:
        # 没有 VarStore: 简单取第一个 GDEF
        for f in fonts:
            if f.get('GDEF'):
                out['GDEF'] = f['GDEF']
                break

    # ---- GPOS ----
    gpos_fonts = [f for f in fonts if 'GPOS' in f]
    if gpos_fonts:
        if offset_map:
            for fi, f in enumerate(fonts):
                if fi in offset_map:
                    remap_gpos_devices(f, offset_map[fi])
        sl, fl, ll = merge_layout(gpos_fonts, 'GPOS')
        gpos = newTable('GPOS')
        gpos.table = ot.GPOS()
        gpos.table.Version = 0x00010000
        gpos.table.ScriptList = sl
        gpos.table.FeatureList = fl
        gpos.table.LookupList = ll
        out['GPOS'] = gpos

    # ---- GSUB ----
    gsub_fonts = [f for f in fonts if 'GSUB' in f]
    if gsub_fonts:
        sl, fl, ll = merge_layout(gsub_fonts, 'GSUB')
        gsub = newTable('GSUB')
        gsub.table = ot.GSUB()
        gsub.table.Version = 0x00010000
        gsub.table.ScriptList = sl
        gsub.table.FeatureList = fl
        gsub.table.LookupList = ll
        out['GSUB'] = gsub

    # ---- HVAR ----
    hvar_fonts = [(i, f) for i, f in enumerate(fonts) if 'HVAR' in f]
    if hvar_fonts:
        vs_list = [f['HVAR'].table.VarStore for _, f in hvar_fonts]
        new_vs, per_font = merge_varstore(vs_list)
        hvar = newTable('HVAR')
        hvar.table = ot.HVAR()
        hvar.table.Version = 0x00010000
        am = ot.VarIdxMap()
        am.mapping = {}
        for pi, (fi, f) in enumerate(hvar_fonts):
            src = f['HVAR'].table.AdvWidthMap
            if src is None:
                continue
            offs = per_font[pi]
            for gname, varidx in src.mapping.items():
                outer = varidx >> 16
                inner = varidx & 0xFFFF
                new_idx = (outer << 16) | (inner + offs.get(outer, 0))
                am.mapping.setdefault(gname, new_idx)
        am.mapCount = len(am.mapping)
        hvar.table.AdvWidthMap = am
        hvar.table.LsbMap = None
        hvar.table.RsbMap = None
        hvar.table.VarStore = new_vs
        out['HVAR'] = hvar

    out.flavor = 'woff2'
    out.save(output)
    print(f"saved {output}")


if __name__ == '__main__':
    main()
