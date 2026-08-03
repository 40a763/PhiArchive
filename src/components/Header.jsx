import { useMemo } from 'react'
import NumberFlow from '@number-flow/react'
import './Header.css'

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  )
}

function padSpaces(num, digits = 3) {
  const str = String(num)
  const count = Math.max(0, digits - str.length)
  return ' '.repeat(count)
}

export function Header({
  total,
  filtered,
  query,
  onQueryChange,
  filters,
  onFilterChange,
  entries,
  isMobile,
}) {
  const chapters = useMemo(() => uniqueSorted(entries.map((e) => e.章节)), [entries])
  const keepers = useMemo(() => uniqueSorted(entries.map((e) => e.保管单位)), [entries])
  const levels = useMemo(() => uniqueSorted(entries.map((e) => e.等级)), [entries])

  return (
    <header className="tui-header">
      <div className="tui-header__title">
        <span className="tui-header__brand">PhiArchive</span>
      </div>

      {!isMobile && (
        <div className="tui-header__status">
          <span className="tui-header__stat-label">ENTRIES</span>
          <span className="tui-header__stat-value">
            <span className="tui-header__stat-pad">{padSpaces(filtered)}</span>
            <NumberFlow value={filtered} format={{ useGrouping: false }} />
            <span className="tui-header__stat-sep">/</span>
            <span className="tui-header__stat-pad">{padSpaces(total)}</span>
            <NumberFlow value={total} format={{ useGrouping: false }} />
          </span>
        </div>
      )}

      <div className="tui-header__search">
        <span className="tui-header__prompt">{'>'}</span>
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
            className="tui-header__search-clear"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {!isMobile && (
        <div className="tui-header__filters">
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
      )}
    </header>
  )
}

export function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="tui-filter">
      <span className="tui-filter__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">ALL</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}
