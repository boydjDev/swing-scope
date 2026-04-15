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
}

export default function Header({ importing, onImport, onWipe, theme, onToggleTheme, profiles, activeProfile, onProfileChange, onAddProfile }: HeaderProps) {
  return (
    <header>
      <h1>SwingScope — Session Analyzer</h1>
      <div className="header-actions">
        {profiles.length > 0 && (
          <div className="profile-selector">
            <select
              value={activeProfile?.id ?? ''}
              onChange={e => {
                const profile = profiles.find(p => p.id === parseInt(e.target.value))
                if (profile) onProfileChange(profile)
              }}
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="profile-add" onClick={onAddProfile} title="Add profile">+</button>
          </div>
        )}
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
