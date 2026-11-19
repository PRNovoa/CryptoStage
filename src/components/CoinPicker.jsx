import { useId, useState } from 'react'
import { addError, MAX_WATCHLIST } from '../watchlist.js'

export default function CoinPicker({ products, watchlist, onAdd }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const listId = useId()
  const errorId = useId()
  const full = watchlist.length >= MAX_WATCHLIST
  const blocked = products === undefined ? 'Loading the coin list…' : products === null ? "Couldn't load the coin list. Prices still stream." : full ? `Watchlist is full (${MAX_WATCHLIST}).` : null

  const submit = (e) => {
    e.preventDefault()
    const symbol = value.trim().toUpperCase()
    const reason = addError(symbol, watchlist, products ?? null)
    setError(reason)
    if (!reason) {
      onAdd(symbol)
      setValue('')
    }
  }

  const message = error ?? blocked
  return (
    <form className="picker" onSubmit={submit}>
      <label className="sr-only" htmlFor={listId + 'input'}>Add coin</label>
      <input
        id={listId + 'input'}
        list={listId}
        value={value}
        placeholder="Add coin, e.g. SOLUSD"
        autoComplete="off"
        spellCheck="false"
        aria-describedby={message ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
      />
      <datalist id={listId}>
        {(products ?? []).map((p) => (
          <option key={p.symbol} value={p.symbol}>{p.description}</option>
        ))}
      </datalist>
      <button type="submit" disabled={Boolean(blocked)}>Add</button>
      {message && <p id={errorId} className="picker-message">{message}</p>}
    </form>
  )
}
