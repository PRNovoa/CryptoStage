export default function DemoStartError() {
  const live = new URL(window.location.href)
  live.searchParams.delete('demo')
  return (
    <main className="start-error">
      <p>Couldn't start demo data. No connection was opened.</p>
      <button type="button" onClick={() => window.location.reload()}>Retry</button>
      <a href={live.pathname + live.search}>Use live data</a>
    </main>
  )
}
