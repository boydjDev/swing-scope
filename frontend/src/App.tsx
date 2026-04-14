import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './styles/global.css'
import './styles/Modal.css'

import type { Session, Shot, ImportSummary } from './types'
import Header from './components/Header'
import ImportSummaryPanel from './components/ImportSummary'
import SessionList from './components/SessionList'
import ShotScatterPlot from './components/ShotScatterPlot'

// "04/01/2026 5:55 PM" → "2026-04-01" for date input comparison
function sessionDateToISO(dateStr: string): string {
  const [mm, dd, yyyy] = dateStr.split(' ')[0].split('/')
  return `${yyyy}-${mm}-${dd}`
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [allSelected, setAllSelected] = useState(false)
  const [shots, setShots] = useState<Shot[]>([])
  const [loadingShots, setLoadingShots] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)

  useEffect(() => {
    loadSessions(true)
  }, [])

  async function loadSessions(autoSelect = false) {
    try {
      const result = await invoke<Session[]>('get_sessions')
      setSessions(result)
      if (autoSelect && result.length > 0) {
        handleSelectSession(result[0])
      }
    } catch (e) {
      console.error('Failed to load sessions:', e)
    }
  }

  useEffect(() => {
    if (allSelected) handleSelectAll()
  }, [fromDate, toDate])

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const iso = sessionDateToISO(s.date)
      if (fromDate && iso < fromDate) return false
      if (toDate && iso > toDate) return false
      return true
    })
  }, [sessions, fromDate, toDate])

  async function handleSelectSession(session: Session) {
    setAllSelected(false)
    setSelected(session)
    setLoadingShots(true)
    try {
      const result = await invoke<Shot[]>('get_shots', { sessionId: session.id })
      setShots(result)
    } finally {
      setLoadingShots(false)
    }
  }

  async function handleSelectAll() {
    setSelected(null)
    setAllSelected(true)
    setLoadingShots(true)
    try {
      const results = await Promise.all(
        filteredSessions.map(s => invoke<Shot[]>('get_shots', { sessionId: s.id }))
      )
      setShots(results.flat())
    } finally {
      setLoadingShots(false)
    }
  }

  async function handleDelete(session: Session) {
    await invoke('delete_session', { sessionId: session.id })
    if (selected?.id === session.id) {
      setSelected(null)
      setShots([])
    }
    await loadSessions()
  }

  async function handleWipe() {
    await invoke('wipe_db')
    setSummary(null)
    setSessions([])
    setSelected(null)
    setAllSelected(false)
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
      <Header importing={importing} onImport={handleImport} onWipe={handleWipe} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />

      {summary && <ImportSummaryPanel summary={summary} onDismiss={() => setSummary(null)} />}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Delete Session</p>
            <p className="modal-body">
              Are you sure you want to delete <strong>{deleteTarget.player_name}</strong>'s session on <strong>{deleteTarget.date}</strong>? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="modal-confirm" onClick={() => { handleDelete(deleteTarget); setDeleteTarget(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="workspace">
        <SessionList
          sessions={filteredSessions}
          selected={selected}
          allSelected={allSelected}
          fromDate={fromDate}
          toDate={toDate}
          onFromDate={setFromDate}
          onToDate={setToDate}
          onSelect={handleSelectSession}
          onSelectAll={handleSelectAll}
          onDelete={setDeleteTarget}
        />

        <main className="shot-view">
          <ShotScatterPlot
            selected={selected}
            allSelected={allSelected}
            fromDate={fromDate}
            toDate={toDate}
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
