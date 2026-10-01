import { useRef, useEffect, useMemo } from 'react'
import NumberFlow from '@number-flow/react'
import './EntryList.css'
import './Header.css'
import { FilterSelect } from './Header.jsx'

function padSpaces(num, digits = 3) {
  const str = String(num)
  const count = Math.max(0, digits - str.length)
  return ' '.repeat(count)
}

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

// "第一章冰封世界" → "1-冰封世界"; "支线章节一忘忧宫" → "S1-忘忧宫"; "外传章节极星卫" → "外-极星卫"
function shortChapter(chapter) {
  const text = String(chapter || '')
  let m = text.match(/^第([一二三四五六七八九])章(.*)$/)
  if (m) return `${CN_NUM[m[1]]}-${m[2]}`
  m = text.match(/^支线章节([一二三四五六七八九])(.*)$/)
  if (m) return `S${CN_NUM[m[1]]}-${m[2]}`
  m = text.match(/^外传章节(.*)$/)
  if (m) return `外-${m[1]}`
  return text
}

function countMatches(entry, query) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return 0
  return [entry.收集品, entry.内容, entry.保管单位, entry.章节, entry.编号].reduce(
    (sum, field) => {
      const text = String(field || '').toLowerCase()
      return text ? sum + (text.split(q).length - 1) : sum
    },
    0,
  )
}

export function EntryList({
  entries,
  selectedId,
  onSelect,
  fastNav,
  query,
  onQueryChange,
  total,
  chapterName,
  filters,
  onFilterChange,
  chapters,
  keepers,
  levels,
}) {
  const listRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedId])

  const pageText = useMemo(() => {
    const current = entries.findIndex((e) => e.id === selectedId) + 1
    return `${current || 0}/${entries.length}`
  }, [entries, selectedId])

  return (
    <div className={`tui-list${fastNav ? ' tui-list--fast-nav' : ''}`} ref={listRef}>
      {/* Panel header */}
      <div className="tui-list__panel-header">
        <span className="tui-list__panel-title">FOLDER_INFORMATION</span>
      </div>

      {/* Search bar */}
      <div className="tui-list__search">
        <span className="tui-list__search-prompt">{'>'}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="SEARCH..."
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="tui-list__search-clear"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="tui-list__filters">
        <FilterSelect
          label="CHAPTER"
          value={filters.chapter}
          options={chapters}
          onChange={(v) => onFilterChange('chapter', v)}
        />
        <FilterSelect
          label="KEEPER"
          value={filters.keeper}
          options={keepers}
          onChange={(v) => onFilterChange('keeper', v)}
        />
        <FilterSelect
          label="LEVEL"
          value={filters.level}
          options={levels}
          onChange={(v) => onFilterChange('level', v)}
        />
      </div>

      {/* CONTENT label — tab attached to the left edge of the card */}
      <div className="tui-list__tabs">
        <span className="tui-list__section-label">CONTENT</span>
      </div>

      {/* File list */}
      <div className="tui-list__body">
        {entries.length === 0 ? (
          <div className="tui-list__empty">No matching entries found.</div>
        ) : (
          entries.map((entry) => {
            const isSelected = entry.id === selectedId
            return (
              <div
                key={entry.id}
                ref={isSelected ? selectedRef : null}
                className={`tui-list__row ${isSelected ? 'tui-list__row--selected' : ''}`}
                onClick={() => onSelect(entry.id)}
              >
                <span className="tui-list__col tui-list__col--name">{entry.收集品 || '-'}</span>
                <span className="tui-list__chapter">{shortChapter(entry.章节)}</span>
                {query ? (
                  <span className="tui-list__count">{countMatches(entry, query)}</span>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      {/* Footer: page indicator */}
      <div className="tui-list__footer">
        <span className="tui-list__page">
          <span className="tui-list__page-pad">{padSpaces(pageText.split('/')[0])}</span>
          <NumberFlow
            value={parseInt(pageText.split('/')[0], 10) || 0}
            format={{ useGrouping: false }}
          />
          <span className="tui-list__page-sep">/</span>
          <NumberFlow
            value={entries.length}
            format={{ useGrouping: false }}
          />
        </span>
      </div>
    </div>
  )
}
