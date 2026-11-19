import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'
import DemoStartError from './components/DemoStartError.jsx'

const root = createRoot(document.getElementById('root'))
const demo = new URLSearchParams(window.location.search).get('demo') === '1'

async function startDemo() {
  try {
    const [{ demoHandlers, simulateGap }, { setupWorker }] = await Promise.all([import('./demo/handlers.js'), import('msw/browser')])
    await setupWorker(...demoHandlers).start({ onUnhandledFrame: 'bypass', quiet: true })
    return simulateGap
  } catch {
    return null
  }
}

if (demo) {
  const simulateGap = await startDemo()
  root.render(<StrictMode>{simulateGap ? <App onSimulateGap={simulateGap} /> : <DemoStartError />}</StrictMode>)
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
