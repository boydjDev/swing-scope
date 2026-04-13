import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './App.css'

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
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [allSelected, setAllSelected] = useState(false)
  const [shots, setShots] = useState<Shot[]>([])
  const [loadingShots, setLoadingShots] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
      <Header importing={importing} onImport={handleImport} onWipe={handleWipe} />

      {summary && <ImportSummaryPanel summary={summary} onDismiss={() => setSummary(null)} />}

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
