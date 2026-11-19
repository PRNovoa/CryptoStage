import Icon from './Icon.jsx'
import { direction, formatChange } from '../format.js'

// Up/down is carried by the icon, hidden text and the sign, never by color alone.
export default function Change({ pct }) {
  const dir = direction(pct)
  return (
    <span className="change" data-dir={dir}>
      {dir !== 'flat' && <Icon name={dir} />}
      {dir !== 'flat' && <span className="sr-only">{dir}</span>}
      <span>{formatChange(pct)}</span>
    </span>
  )
}
