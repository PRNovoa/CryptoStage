const PATHS = {
  up: 'M4 10.5 8 5.5l4 5',
  down: 'M4 5.5 8 10.5l4-5',
  remove: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  back: 'M10 3.5 5.5 8l4.5 4.5',
}

export default function Icon({ name }) {
  return (
    <svg data-icon={name} className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
