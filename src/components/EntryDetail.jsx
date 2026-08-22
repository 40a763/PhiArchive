import { useEffect, useRef, useState } from 'react'
import './EntryDetail.css'

function display(value) {
  return value && String(value).trim() ? value : '-'
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text, query) {
  if (!query || !String(query).trim()) return text
  const safeQuery = escapeRegex(String(query).trim())
  if (!safeQuery) return text
  const testRegex = new RegExp(safeQuery, 'i')
  const splitRegex = new RegExp(`(${safeQuery})`, 'gi')
  const parts = String(text).split(splitRegex)
  return parts.map((part, index) =>
    testRegex.test(part) ? (
      <mark key={index} className="tui-detail__highlight">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

function lineContainsQuery(line, query) {
  if (!query || !String(query).trim()) return false
  const safeQuery = escapeRegex(String(query).trim())
  if (!safeQuery) return false
  return new RegExp(safeQuery, 'i').test(line)
}

function InfoLine({ label, value, valueWeight = 'var(--fw-regular)' }) {
  const renderValue = () => (
    <span className="tui-detail__info-value" style={{ fontWeight: valueWeight }}>
      {display(value)}
    </span>
  )

  return (
    <span className="tui-detail__info-item">
      <span className="tui-detail__info-label">{label}</span>
      {renderValue()}
    </span>
  )
}

export function EntryDetail({ entry, onBack, isMobile, query }) {
  const bodyRef = useRef(null)
  const [selectedLineIndices, setSelectedLineIndices] = useState(() => new Set())

  useEffect(() => {
    function handleSelectionChange() {
      const body = bodyRef.current
      if (!body) {
        setSelectedLineIndices(new Set())
        return
      }
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelectedLineIndices(new Set())
        return
      }
      const range = selection.getRangeAt(0)
      if (!body.contains(range.commonAncestorContainer)) {
        setSelectedLineIndices(new Set())
        return
      }
      const lines = body.querySelectorAll('.tui-detail__line')
      const next = new Set()
      lines.forEach((lineEl, index) => {
        if (range.intersectsNode(lineEl)) next.add(index)
      })
      setSelectedLineIndices(next)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  useEffect(() => {
    setSelectedLineIndices(new Set())
  }, [entry])

  if (!entry) {
    return (
      <div className="tui-detail tui-detail--empty">
        <span>Select an entry from the list.</span>
      </div>
    )
  }

  return (
    <div className="tui-detail">
      <div className="tui-detail__info">
        <div className="tui-detail__info-row">
          {isMobile && (
            <button
              type="button"
              className="tui-detail__back"
              onClick={onBack}
              aria-label="Back to list"
            >
              {'<'}
            </button>
          )}
          <span className="tui-detail__name">{display(entry.收集品)}</span>
          <span className="tui-detail__meta">
            <InfoLine label="ID" value={entry.编号} valueWeight="var(--fw-bold)" />
            <InfoLine label="CHAPTER" value={entry.章节} valueWeight="var(--fw-bold)" />
          </span>
        </div>
        <div className="tui-detail__info-row">
          <InfoLine label="DATE" value={entry.收集时间} />
          <InfoLine label="KEEPER" value={entry.保管单位} />
          <InfoLine label="LEVEL" value={entry.等级} />
          <InfoLine label="LEN" value={entry.长度} />
          <InfoLine label="STYLE" value={entry.款式} />
          <InfoLine label="RESEARCH" value={entry.碎数研编号} />
        </div>
      </div>

      <div className="tui-detail__content">
        <div className="tui-detail__content-header">CONTENT</div>
        <div className="tui-detail__content-body" ref={bodyRef}>
        {entry.内容 && String(entry.内容).trim() ? (
          String(entry.内容)
            .split(/[\n\u2028]/)
            .map((line, index) => {
              const isMatch = lineContainsQuery(line, query)
              const isSelected = selectedLineIndices.has(index)
              const isHighlighted = isMatch || isSelected
              return (
                <div key={index} className="tui-detail__line">
                  <span
                    className={`tui-detail__line-number${
                      isHighlighted ? ' tui-detail__line-number--highlight' : ''
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="tui-detail__line-content">
                    {highlightText(line, query)}
                  </span>
                </div>
              )
            })
        ) : (
          <div className="tui-detail__line tui-detail__line--empty">
            <span className="tui-detail__line-number">1</span>
            <span className="tui-detail__line-content">[NO CONTENT]</span>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
