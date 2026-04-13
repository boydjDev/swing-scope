import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './App.css'

import type { Session, Shot, ImportSummary } from './types'
import Header from './components/Header'
import ImportSummaryPanel from './components/ImportSummary'
import SessionList from './components/SessionList'
import ShotTable from './components/ShotTable'

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
      <Header importing={importing} onImport={handleImport} onWipe={handleWipe} />

      {summary && <ImportSummaryPanel summary={summary} />}

      <div className="workspace">
        <SessionList sessions={sessions} selected={selected} onSelect={handleSelectSession} />

        <main className="shot-view">
          <ShotTable
            selected={selected}
            shots={shots}
            loading={loadingShots}
            sessionCount={sessions.length}
          />
        </main>
      </div>
    </div>
  )
}

export default App
