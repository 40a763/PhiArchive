export function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className={`tui-filter${value ? ' tui-filter--active' : ''}`}>
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
