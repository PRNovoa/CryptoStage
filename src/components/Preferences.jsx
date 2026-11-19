const THEMES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]

export default function Preferences({ theme, motion, onTheme, onMotion }) {
  return (
    <div className="prefs">
      <fieldset className="segmented">
        <legend>Theme</legend>
        {THEMES.map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => onTheme(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" className="toggle" aria-pressed={motion === 'on'} onClick={() => onMotion(motion === 'on' ? 'off' : 'on')}>
        Motion {motion === 'on' ? 'on' : 'off'}
      </button>
    </div>
  )
}
