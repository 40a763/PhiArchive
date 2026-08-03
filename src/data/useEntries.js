import { useEffect, useState } from 'react'
import Papa from 'papaparse'

export const FIELD_LABELS = {
  收集品: 'NAME',
  内容: 'CONTENT',
  收集时间: 'DATE',
  保管单位: 'KEEPER',
  等级: 'LEVEL',
  长度: 'LEN',
  款式: 'STYLE',
  碎数研编号: 'RESEARCH_ID',
  章节: 'CHAPTER',
  编号: 'ID',
}

export function useEntries() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${import.meta.env.BASE_URL}files/PhigrOS_SATURN.csv`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        // Remove the first metadata line "PhigrOS_SATURN Virtual OS,..."
        const lines = text.split(/\r?\n/)
        const withoutMeta = lines.slice(1).join('\n')

        Papa.parse(withoutMeta, {
          header: true,
          skipEmptyLines: true,
          encoding: 'utf-8',
          complete: (results) => {
            if (cancelled) return
            const rows = results.data
              .filter((row) => row.内容 && String(row.内容).trim())
              .sort((a, b) => {
                const na = parseInt(a.编号, 10) || 0
                const nb = parseInt(b.编号, 10) || 0
                return na - nb
              })
              .map((row, index) => ({
                id: index,
                ...row,
              }))
            setEntries(rows)
            setLoading(false)
          },
          error: (err) => {
            if (cancelled) return
            setError(err.message)
            setLoading(false)
          },
        })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { entries, loading, error }
}
