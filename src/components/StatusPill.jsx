import { ageSeconds } from '../format.js'

const LABELS = { connecting: 'Connecting', reconnecting: 'Reconnecting', stale: 'Stale' }

// Silent while the stream is healthy; the live region stays mounted so a change is announced.
export default function StatusPill({ status, nowMs, lastMessageAt, retryInMs }) {
  let detail = null
  if (status === 'reconnecting' && retryInMs != null) detail = `in ${Math.ceil(retryInMs / 1000)}s`
  else if (status === 'stale' && lastMessageAt) detail = `last message ${Math.max(0, ageSeconds(nowMs, lastMessageAt))}s ago`
  return (
    <p className="conn" data-status={status}>
      <span role="status">{LABELS[status] ?? ''}</span>
      {detail && <span className="conn-detail">{detail}</span>}
    </p>
  )
}
