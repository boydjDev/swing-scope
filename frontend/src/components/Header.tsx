import '../styles/Header.css'

interface HeaderProps {
  importing: boolean
  onImport: () => void
  onWipe: () => void
  profiles: Profile[]
  activeProfile: Profile | null
  onProfileChange: (profile: Profile) => void
  onAddProfile: () => void
  onDeleteProfile: (profile: Profile) => void
}

export default function Header({ importing, onImport, onWipe, profiles, activeProfile, onProfileChange, onAddProfile, onDeleteProfile }: HeaderProps) {
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
      <h1>SwingScope — Session Analyzer</h1>
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
