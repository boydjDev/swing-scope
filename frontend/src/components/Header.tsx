interface HeaderProps {
  importing: boolean
  onImport: () => void
  onWipe: () => void
}

export default function Header({ importing, onImport, onWipe }: HeaderProps) {
  return (
    <header>
      <h1>SwingScope</h1>
      <div className="header-actions">
        {import.meta.env.DEV && (
          <button className="wipe" onClick={onWipe}>Wipe DB</button>
        )}
        <button onClick={onImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import CSV'}
        </button>
      </div>
    </header>
  )
}
