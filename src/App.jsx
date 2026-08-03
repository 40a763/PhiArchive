import { useEffect, useMemo, useState, useCallback } from 'react'
import NumberFlow from '@number-flow/react'
import { useEntries } from './data/useEntries.js'
import { Header, FilterSelect } from './components/Header.jsx'
import { EntryList } from './components/EntryList.jsx'
import { EntryDetail } from './components/EntryDetail.jsx'
import './App.css'

function normalize(text) {
  return String(text || '').toLowerCase().trim()
}

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

function entryMatches(entry, query) {
  if (!query) return true
  const q = normalize(query)
  return (
    normalize(entry.收集品).includes(q) ||
    normalize(entry.内容).includes(q) ||
    normalize(entry.保管单位).includes(q) ||
    normalize(entry.章节).includes(q) ||
    normalize(entry.编号).includes(q)
  )
}

const MOBILE_BREAKPOINT = '(max-width: 768px)'

export default function App() {
  const { entries, loading, error } = useEntries()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ chapter: '', keeper: '', level: '' })
  const [selectedId, setSelectedId] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_BREAKPOINT).matches,
  )
  const [showDetail, setShowDetail] = useState(false)

  const chapters = useMemo(() => uniqueSorted(entries.map((e) => e.章节)), [entries])
  const keepers = useMemo(() => uniqueSorted(entries.map((e) => e.保管单位)), [entries])
  const levels = useMemo(() => uniqueSorted(entries.map((e) => e.等级)), [entries])

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!entryMatches(entry, query)) return false
      if (filters.chapter && entry.章节 !== filters.chapter) return false
      if (filters.keeper && entry.保管单位 !== filters.keeper) return false
      if (filters.level && entry.等级 !== filters.level) return false
      return true
    })
  }, [entries, query, filters])

  // Keep selection valid when filter/query changes
  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedId(null)
      return
    }
    const stillVisible = filteredEntries.some((e) => e.id === selectedId)
    if (!stillVisible) {
      setSelectedId(filteredEntries[0].id)
    }
  }, [filteredEntries, selectedId])

  // Default selection when data loads
  useEffect(() => {
    if (selectedId === null && filteredEntries.length > 0) {
      setSelectedId(filteredEntries[0].id)
    }
  }, [filteredEntries, selectedId])

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSelect = useCallback(
    (id) => {
      setSelectedId(id)
      if (isMobile) setShowDetail(true)
    },
    [isMobile],
  )

  const handleBack = useCallback(() => {
    setShowDetail(false)
  }, [])

  const moveSelection = useCallback(
    (delta) => {
      if (filteredEntries.length === 0) return
      const currentIndex = filteredEntries.findIndex((e) => e.id === selectedId)
      const nextIndex = Math.max(
        0,
        Math.min(filteredEntries.length - 1, currentIndex + delta),
      )
      setSelectedId(filteredEntries[nextIndex].id)
    },
    [filteredEntries, selectedId],
  )

  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveSelection(-1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveSelection(1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moveSelection])

  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])

  const resize = useCallback(
    (e) => {
      if (!isResizing) return
      const newWidth = Math.max(240, Math.min(720, e.clientX))
      setSidebarWidth(newWidth)
    },
    [isResizing],
  )

  useEffect(() => {
    if (!isResizing) return
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  const selectedEntry = useMemo(
    () => filteredEntries.find((e) => e.id === selectedId) || null,
    [filteredEntries, selectedId],
  )

  if (loading) {
    return (
      <div className="tui-app tui-app--centered">
        <span className="tui-app__loading">Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tui-app tui-app--centered">
        <span className="tui-app__error">Error: {error}</span>
      </div>
    )
  }

  return (
    <div className="tui-app">
      <Header
        total={entries.length}
        filtered={filteredEntries.length}
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFilterChange={handleFilterChange}
        entries={entries}
        isMobile={isMobile}
      />
      <main className="tui-app__main">
        <aside
          className="tui-app__sidebar"
          style={
            isMobile
              ? undefined
              : { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }
          }
        >
          <EntryList
            entries={filteredEntries}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
          {isMobile && (
            <div className="tui-app__mobile-footer">
              <div className="tui-app__mobile-status">
                <span className="tui-app__mobile-status-label">ENTRIES</span>
                <span className="tui-app__mobile-status-value">
                  <span className="tui-app__mobile-status-pad">{padSpaces(filteredEntries.length)}</span>
                  <NumberFlow value={filteredEntries.length} format={{ useGrouping: false }} />
                  <span className="tui-app__mobile-status-sep">/</span>
                  <span className="tui-app__mobile-status-pad">{padSpaces(entries.length)}</span>
                  <NumberFlow value={entries.length} format={{ useGrouping: false }} />
                </span>
              </div>
              <div className="tui-app__mobile-filters">
                <FilterSelect
                  label="CHAPTER"
                  value={filters.chapter}
                  options={chapters}
                  onChange={(v) => handleFilterChange('chapter', v)}
                />
                <FilterSelect
                  label="KEEPER"
                  value={filters.keeper}
                  options={keepers}
                  onChange={(v) => handleFilterChange('keeper', v)}
                />
                <FilterSelect
                  label="LEVEL"
                  value={filters.level}
                  options={levels}
                  onChange={(v) => handleFilterChange('level', v)}
                />
              </div>
            </div>
          )}
        </aside>
        {!isMobile && (
          <div
            className={`tui-app__resizer ${isResizing ? 'tui-app__resizer--active' : ''}`}
            onMouseDown={startResizing}
            title="Drag to resize"
          />
        )}
        <section
          className={`tui-app__detail ${isMobile ? 'tui-app__detail--mobile' : ''} ${isMobile && showDetail ? 'tui-app__detail--visible' : ''}`}
        >
          <EntryDetail entry={selectedEntry} onBack={handleBack} isMobile={isMobile} query={query} />
        </section>
      </main>
    </div>
  )
}
