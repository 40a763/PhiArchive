import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useEntries } from './data/useEntries.js'
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
  const [sidebarWidth, setSidebarWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_BREAKPOINT).matches,
  )
  const [showDetail, setShowDetail] = useState(false)
  const [fastNav, setFastNav] = useState(false)
  const lastArrowAtRef = useRef(0)
  const fastNavTimerRef = useRef(null)
  const sidebarRef = useRef(null)
  const detailRef = useRef(null)

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

  const moveSelectionRef = useRef(moveSelection)
  useEffect(() => {
    moveSelectionRef.current = moveSelection
  }, [moveSelection])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const now = performance.now()
        const isFast = e.repeat || now - lastArrowAtRef.current < 200
        lastArrowAtRef.current = now
        if (isFast) setFastNav(true)
        if (fastNavTimerRef.current) clearTimeout(fastNavTimerRef.current)
        fastNavTimerRef.current = setTimeout(() => setFastNav(false), 280)
        moveSelectionRef.current(e.key === 'ArrowUp' ? -1 : 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (fastNavTimerRef.current) clearTimeout(fastNavTimerRef.current)
    }
  }, [])

  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])

  const resize = useCallback(
    (e) => {
      if (!isResizing) return
      const newWidth = Math.max(240, Math.min(560, e.clientX))
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

  const chapterName = selectedEntry?.章节 || ''

  // Mouse-tracking 3D tilt — each card tilts independently toward the mouse
  useEffect(() => {
    if (isMobile) return
    let rafId = null

    function tiltCard(el, mouseX, mouseY) {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const ry = ((mouseX - cx) / (rect.width / 2)) * 5.5
      const rx = ((mouseY - cy) / (rect.height / 2)) * -3.5
      const clampedRx = Math.max(-6, Math.min(6, rx))
      const clampedRy = Math.max(-8, Math.min(8, ry))
      el.style.transform =
        `perspective(2200px) rotateX(${clampedRx.toFixed(2)}deg) rotateY(${clampedRy.toFixed(2)}deg)`
    }

    function handleMouseMove(e) {
      if (rafId) return
      const { clientX, clientY } = e
      rafId = requestAnimationFrame(() => {
        rafId = null
        tiltCard(sidebarRef.current, clientX, clientY)
        tiltCard(detailRef.current, clientX, clientY)
      })
    }

    function handleMouseLeave() {
      if (sidebarRef.current) sidebarRef.current.style.transform = ''
      if (detailRef.current) detailRef.current.style.transform = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMobile])

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
      <main className="tui-app__main">
        <aside
          ref={sidebarRef}
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
            fastNav={fastNav}
            query={query}
            onQueryChange={setQuery}
            total={entries.length}
            chapterName={chapterName}
            filters={filters}
            onFilterChange={handleFilterChange}
            chapters={chapters}
            keepers={keepers}
            levels={levels}
          />
        </aside>
        {!isMobile && (
          <div
            className={`tui-app__resizer ${isResizing ? 'tui-app__resizer--active' : ''}`}
            onMouseDown={startResizing}
            title="Drag to resize"
          />
        )}
        <section
          ref={detailRef}
          className={`tui-app__detail ${isMobile ? 'tui-app__detail--mobile' : ''} ${isMobile && showDetail ? 'tui-app__detail--visible' : ''}`}
        >
          <EntryDetail entry={selectedEntry} onBack={handleBack} isMobile={isMobile} query={query} />
        </section>
      </main>
    </div>
  )
}
