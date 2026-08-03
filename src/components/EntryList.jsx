import { useRef, useEffect } from 'react'
import './EntryList.css'

export function EntryList({ entries, selectedId, onSelect }) {
  const listRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedId])

  return (
    <div className="tui-list" ref={listRef}>
      <div className="tui-list__header">
        <span className="tui-list__col tui-list__col--id">NO.</span>
        <span className="tui-list__col tui-list__col--name">NAME</span>
        <span className="tui-list__col tui-list__col--chapter">CHAPTER</span>
      </div>

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
                <span className="tui-list__col tui-list__col--id">{entry.编号 || '-'}</span>
                <span className="tui-list__col tui-list__col--name">{entry.收集品 || '-'}</span>
                <span className="tui-list__col tui-list__col--chapter">{entry.章节 || '-'}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
