import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './styles/global.css'

import type { Session, Shot, ImportSummary, Profile } from './types'
import Header from './components/Header'
import ImportSummaryPanel from './components/ImportSummary'
import SessionList from './components/SessionList'
import ShotScatterPlot from './components/ShotScatterPlot'
import ConfirmDialog from './components/ConfirmDialog'

// "04/01/2026 5:55 PM" → "2026-04-01" for date input comparison
function sessionDateToISO(dateStr: string): string {
  const [mm, dd, yyyy] = dateStr.split(' ')[0].split('/')
  return `${yyyy}-${mm}-${dd}`
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme')
    const t = (stored === 'light' || stored === 'dark') ? stored : 'dark'
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
  const [deleteTargets, setDeleteTargets] = useState<Session[]>([])
  const [profileDeleteTarget, setProfileDeleteTarget] = useState<Profile | null>(null)

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

  async function handleDeleteProfile(profile: Profile) {
    await invoke('delete_profile', { profileId: profile.id })
    const remaining = profiles.filter(p => p.id !== profile.id)
    setProfiles(remaining)
    if (remaining.length === 0) {
      setActiveProfile(null)
      setSessions([])
      setSelected(null)
      setAllSelected(false)
      setShots([])
      setShowNamePrompt(true)
    } else if (activeProfile?.id === profile.id) {
      const next = remaining[0]
      setActiveProfile(next)
      localStorage.setItem('activeProfileId', next.id.toString())
      loadSessions()
    } else {
      loadSessions()
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

  async function handleDeleteMultiple(targets: Session[]) {
    for (const s of targets) {
      await invoke('delete_session', { sessionId: s.id })
    }
    if (targets.some(s => s.id === selected?.id)) {
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
        onDeleteProfile={p => setProfileDeleteTarget(p)}
      />

      {summary && <ImportSummaryPanel summary={summary} onDismiss={() => setSummary(null)} />}

      {showNamePrompt && (
        <ConfirmDialog
          title="Welcome to SwingScope"
          confirmLabel="Get Started"
          confirmDisabled={!newProfileName.trim()}
          onConfirm={handleCreateFirstProfile}
          input={{
            value: newProfileName,
            placeholder: 'Your name',
            onChange: setNewProfileName,
            onEnter: handleCreateFirstProfile,
          }}
        >
          Enter your name to create your first profile.
        </ConfirmDialog>
      )}

      {showAddProfile && (
        <ConfirmDialog
          title="Add Profile"
          confirmLabel="Add"
          confirmDisabled={!newProfileName.trim()}
          onConfirm={handleAddProfile}
          onCancel={() => setShowAddProfile(false)}
          input={{
            value: newProfileName,
            placeholder: 'Name',
            onChange: setNewProfileName,
            onEnter: handleAddProfile,
          }}
        />
      )}

      {profileDeleteTarget && (
        <ConfirmDialog
          title="Delete Profile"
          confirmLabel="Delete"
          onConfirm={() => { handleDeleteProfile(profileDeleteTarget); setProfileDeleteTarget(null) }}
          onCancel={() => setProfileDeleteTarget(null)}
        >
          Are you sure you want to delete <strong>{profileDeleteTarget.name}</strong>? All sessions and shots associated with this profile will also be deleted. This cannot be undone.
        </ConfirmDialog>
      )}

      {deleteTargets.length > 0 && (
        <ConfirmDialog
          title={deleteTargets.length === 1 ? 'Delete Session' : `Delete ${deleteTargets.length} Sessions`}
          confirmLabel="Delete"
          onConfirm={() => { handleDeleteMultiple(deleteTargets); setDeleteTargets([]) }}
          onCancel={() => setDeleteTargets([])}
        >
          {deleteTargets.length === 1
            ? <>Are you sure you want to delete <strong>{deleteTargets[0].player_name}</strong>'s session on <strong>{deleteTargets[0].date}</strong>? This cannot be undone.</>
            : <>Are you sure you want to delete <strong>{deleteTargets.length} sessions</strong>? This cannot be undone.</>
          }
        </ConfirmDialog>
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
          onDeleteMultiple={setDeleteTargets}
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
            onShotDeleted={id => setShots(prev => prev.filter(s => s.id !== id))}
          />
        </main>
      </div>
    </div>
  )
}

export default App
