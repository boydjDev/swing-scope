import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './App.css'

interface Session {
  id: number
  player_name: string
  date: string
  source_filename: string
}

interface Shot {
  club_type: string
  club_brand: string
  club_model: string
  carry_distance: number
  total_distance: number
  ball_speed: number
  club_speed: number
  smash_factor: number
  launch_angle: number
  launch_direction: number
  apex: number
  side_carry: number
  descent_angle: number
  attack_angle: number
  club_path: number
  spin_rate: number
  spin_axis: number
  club_data_est: number
}

interface ImportResult {
  filename: string
  status: 'imported' | 'skipped' | 'error'
  message: string
}

interface ImportSummary {
  results: ImportResult[]
  imported: number
  skipped: number
  errors: number
}

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [loadingShots, setLoadingShots] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    try {
      const result = await invoke<Session[]>('get_sessions')
      setSessions(result)
    } catch (e) {
      console.error('Failed to load sessions:', e)
    }
  }

  async function handleSelectSession(session: Session) {
    setSelected(session)
    setLoadingShots(true)
    try {
      const result = await invoke<Shot[]>('get_shots', { sessionId: session.id })
      setShots(result)
    } finally {
      setLoadingShots(false)
    }
  }

  async function handleWipe() {
    await invoke('wipe_db')
    setSummary(null)
    setSessions([])
    setSelected(null)
    setShots([])
  }

  async function handleImport() {
    const filePaths = await open({
      multiple: true,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })

    if (!filePaths || filePaths.length === 0) return

    setImporting(true)
    setSummary(null)

    try {
      const result = await invoke<ImportSummary>('import_sessions', { filePaths })
      setSummary(result)
      await loadSessions()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div id="app">
      <header>
        <h1>SwingScope</h1>
        <div className="header-actions">
          {import.meta.env.DEV && (
            <button className="wipe" onClick={handleWipe}>Wipe DB</button>
          )}
          <button onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
      </header>

      {summary && (
        <div className="summary">
          <p>
            {summary.imported > 0 && <span className="ok">{summary.imported} imported</span>}
            {summary.skipped > 0 && <span className="warn">{summary.skipped} skipped</span>}
            {summary.errors > 0 && <span className="err">{summary.errors} failed</span>}
          </p>
          <ul>
            {summary.results.map(r => (
              <li key={r.filename} className={r.status}>
                <span className="fname">{r.filename}</span>
                <span className="msg">{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="workspace">
        <nav className="session-list">
          {sessions.length === 0 ? (
            <p className="empty-nav">No sessions yet</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                className={`session-item${selected?.id === s.id ? ' active' : ''}`}
                onClick={() => handleSelectSession(s)}
              >
                <span className="session-player">{s.player_name}</span>
                <span className="session-date">{s.date}</span>
              </button>
            ))
          )}
        </nav>

        <main className="shot-view">
          {!selected ? (
            <p className="empty">
              {sessions.length === 0
                ? 'Import a CSV to get started.'
                : 'Select a session to view shots.'}
            </p>
          ) : loadingShots ? (
            <p className="empty">Loading…</p>
          ) : (
            <>
              <div className="shot-view-header">
                <span className="shot-view-title">{selected.player_name} — {selected.date}</span>
                <span className="shot-count">{shots.length} shots</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Club</th>
                      <th>Model</th>
                      <th>Carry</th>
                      <th>Total</th>
                      <th>Ball Spd</th>
                      <th>Club Spd</th>
                      <th>Smash</th>
                      <th>Lnch Ang</th>
                      <th>Lnch Dir</th>
                      <th>Apex</th>
                      <th>Side</th>
                      <th>Descent</th>
                      <th>Attack</th>
                      <th>Path</th>
                      <th>Spin</th>
                      <th>Axis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shots.map((s, i) => (
                      <tr key={i} className={s.club_data_est ? 'estimated' : ''}>
                        <td className="num">{i + 1}</td>
                        <td>{s.club_type}</td>
                        <td className="model">{s.club_model}</td>
                        <td className="num">{fmt(s.carry_distance)}</td>
                        <td className="num">{fmt(s.total_distance)}</td>
                        <td className="num">{fmt(s.ball_speed)}</td>
                        <td className="num">{fmt(s.club_speed)}</td>
                        <td className="num">{fmt(s.smash_factor, 2)}</td>
                        <td className="num">{fmt(s.launch_angle)}</td>
                        <td className="num">{fmt(s.launch_direction)}</td>
                        <td className="num">{fmt(s.apex)}</td>
                        <td className="num">{fmt(s.side_carry)}</td>
                        <td className="num">{fmt(s.descent_angle)}</td>
                        <td className="num">{fmt(s.attack_angle)}</td>
                        <td className="num">{fmt(s.club_path)}</td>
                        <td className="num">{fmt(s.spin_rate, 0)}</td>
                        <td className="num">{fmt(s.spin_axis)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
