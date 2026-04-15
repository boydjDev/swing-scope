import { useState, useRef, useEffect } from 'react'
import '../styles/Header.css'
import type { Profile } from '../types'

interface HeaderProps {
  importing: boolean
  onImport: () => void
  onWipe: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  profiles: Profile[]
  activeProfile: Profile | null
  onProfileChange: (profile: Profile) => void
  onAddProfile: () => void
  onDeleteProfile: (profile: Profile) => void
}

export default function Header({ importing, onImport, onWipe, theme, onToggleTheme, profiles, activeProfile, onProfileChange, onAddProfile, onDeleteProfile }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setDeleteMode(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header>
      <div className="header-left">
        {activeProfile && (
          <div className="profile-pill-wrap" ref={ref}>
            <button className="profile-pill" onClick={() => setOpen(o => !o)}>
              <span className="profile-pill-name">{activeProfile.name}</span>
              <span className="profile-pill-chevron">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
              <div className="profile-dropdown">
                {deleteMode ? (
                  <>
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        className="profile-dropdown-item profile-dropdown-delete-target"
                        onClick={() => { onDeleteProfile(p); setDeleteMode(false); setOpen(false) }}
                      >
                        {p.name}
                      </button>
                    ))}
                    <div className="profile-dropdown-divider" />
                    <button className="profile-dropdown-item profile-dropdown-cancel" onClick={() => setDeleteMode(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        className={`profile-dropdown-item${p.id === activeProfile.id ? ' active' : ''}`}
                        onClick={() => { onProfileChange(p); setOpen(false) }}
                      >
                        {p.name}
                      </button>
                    ))}
                    <div className="profile-dropdown-divider" />
                    <button className="profile-dropdown-item profile-dropdown-add" onClick={() => { onAddProfile(); setOpen(false) }}>
                      + Add profile
                    </button>
                    {profiles.length > 1 && (
                      <button className="profile-dropdown-item profile-dropdown-delete-mode" onClick={() => setDeleteMode(true)}>
                        − Delete profile
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <h1>Shot Analyzer</h1>
      <div className="header-actions">
        {import.meta.env.DEV && (
          <button className="wipe" onClick={onWipe}>Wipe DB</button>
        )}
        <button onClick={onImport} disabled={importing || !activeProfile}>
          {importing ? 'Importing…' : 'Import CSV'}
        </button>
        <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}
