import NumberFlow from '@number-flow/react'
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
  const isId = label === 'ID'
  const isDate = label === 'DATE'
  const numericValue = isId ? parseInt(value, 10) || 0 : null

  const renderValue = () => {
    if (isId) {
      return (
        <NumberFlow
          value={numericValue}
          format={{ minimumIntegerDigits: 4, useGrouping: false }}
          className="tui-detail__info-value"
          style={{ fontWeight: valueWeight }}
        />
      )
    }

    if (isDate) {
      return (
        <span className="tui-detail__info-value" style={{ fontWeight: valueWeight }}>
          {display(value)}
        </span>
      )
    }

    return (
      <span className="tui-detail__info-value" style={{ fontWeight: valueWeight }}>
        {display(value)}
      </span>
    )
  }

  return (
    <span className="tui-detail__info-item">
      <span className="tui-detail__info-label">{label}</span>
      {renderValue()}
    </span>
  )
}

export function EntryDetail({ entry, onBack, isMobile, query }) {
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
        <div className="tui-detail__content-body">
        {entry.内容 && String(entry.内容).trim() ? (
          String(entry.内容)
            .split('\n')
            .map((line, index) => {
              const isMatch = lineContainsQuery(line, query)
              return (
                <div key={index} className="tui-detail__line">
                  <span
                    className={`tui-detail__line-number${
                      isMatch ? ' tui-detail__line-number--highlight' : ''
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
