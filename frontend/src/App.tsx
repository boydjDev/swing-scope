import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './styles/global.css'
import './styles/Modal.css'

import type { Session, Shot, ImportSummary, Profile } from './types'
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
    const t = (stored === 'light' || stored === 'dark') ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', t)
    return t
  })

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')

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
    initProfiles()
  }, [])

  async function initProfiles() {
    try {
      const result = await invoke<Profile[]>('get_profiles')
      setProfiles(result)
      if (result.length === 0) {
        setShowNamePrompt(true)
      } else {
        const storedId = localStorage.getItem('activeProfileId')
        const stored = storedId ? result.find(p => p.id === parseInt(storedId)) : null
        const active = stored ?? result[0]
        setActiveProfile(active)
        loadSessions(true)
      }
    } catch (e) {
      console.error('Failed to load profiles:', e)
    }
  }

  async function handleCreateFirstProfile() {
    const name = newProfileName.trim()
    if (!name) return
    try {
      const profile = await invoke<Profile>('add_profile', { name })
      setProfiles([profile])
      setActiveProfile(profile)
      localStorage.setItem('activeProfileId', profile.id.toString())
      setShowNamePrompt(false)
      setNewProfileName('')
      loadSessions(true)
    } catch (e) {
      console.error('Failed to create profile:', e)
    }
  }

  async function handleAddProfile() {
    const name = newProfileName.trim()
    if (!name) return
    try {
      const profile = await invoke<Profile>('add_profile', { name })
      setProfiles(prev => [...prev, profile])
      setActiveProfile(profile)
      localStorage.setItem('activeProfileId', profile.id.toString())
      setShowAddProfile(false)
      setNewProfileName('')
    } catch (e) {
      console.error('Failed to add profile:', e)
    }
  }

  function handleProfileChange(profile: Profile) {
    setActiveProfile(profile)
    localStorage.setItem('activeProfileId', profile.id.toString())
    setSelected(null)
    setAllSelected(false)
    setShots([])
    loadSessions()
  }

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
      if (activeProfile && s.profile_id !== activeProfile.id) return false
      const iso = sessionDateToISO(s.date)
      if (fromDate && iso < fromDate) return false
      if (toDate && iso > toDate) return false
      return true
    })
  }, [sessions, activeProfile, fromDate, toDate])

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
      const result = await invoke<ImportSummary>('import_sessions', { filePaths, profileId: activeProfile!.id })
      setSummary(result)
      await loadSessions()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div id="app">
      <Header
        importing={importing}
        onImport={handleImport}
        onWipe={handleWipe}
        theme={theme}
        onToggleTheme={toggleTheme}
        profiles={profiles}
        activeProfile={activeProfile}
        onProfileChange={handleProfileChange}
        onAddProfile={() => { setNewProfileName(''); setShowAddProfile(true) }}
      />

      {summary && <ImportSummaryPanel summary={summary} onDismiss={() => setSummary(null)} />}

      {showNamePrompt && (
        <div className="modal-overlay">
          <div className="modal">
            <p className="modal-title">Welcome to SwingScope</p>
            <p className="modal-body">Enter your name to create your first profile.</p>
            <input
              className="modal-input"
              type="text"
              placeholder="Your name"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFirstProfile()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-confirm" onClick={handleCreateFirstProfile} disabled={!newProfileName.trim()}>
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddProfile && (
        <div className="modal-overlay" onClick={() => setShowAddProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Add Profile</p>
            <input
              className="modal-input"
              type="text"
              placeholder="Name"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddProfile()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowAddProfile(false)}>Cancel</button>
              <button className="modal-confirm" onClick={handleAddProfile} disabled={!newProfileName.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

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
            theme={theme}
          />
        </main>
      </div>
    </div>
  )
}

export default App
