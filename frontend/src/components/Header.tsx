import '../styles/Header.css'

interface HeaderProps {
  importing: boolean
  onImport: () => void
  onWipe: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Header({ importing, onImport, onWipe, theme, onToggleTheme }: HeaderProps) {
  return (
    <header>
      <h1>SwingScope — Session Analyzer</h1>
      <div className="header-actions">
        {import.meta.env.DEV && (
          <button className="wipe" onClick={onWipe}>Wipe DB</button>
        )}
        <button onClick={onImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import CSV'}
        </button>
        <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}
