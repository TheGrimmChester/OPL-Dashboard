import { useEffect, useState } from 'react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8092').replace(/\/$/, '')

export default function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <main className="shell">
      <p className="brand">Open Perf Lab</p>
      <h1>OPL</h1>
      <p className="lede">Scenario designer, load runs, SLA gates, and optional OPA correlation deep-links.</p>
      <p className="meta">API: <code>{API_URL}</code></p>
      {error && <p className="err">Health check failed: {error}</p>}
      {health && (
        <pre className="health">{JSON.stringify(health, null, 2)}</pre>
      )}
    </main>
  )
}
