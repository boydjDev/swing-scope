import ClubStatCard from './ClubStatCard'
import '../styles/StatsTab.css'

export interface ClubStats {
  club: string
  count: number
  avgCarry: number
  avgSideCarry: number
  stdSideCarry: number
}

interface StatsTabProps {
  stats: ClubStats[]
  colorMap: Record<string, string>
  scaleMin: number
  scaleMax: number
}

export default function StatsTab({ stats, colorMap, scaleMin, scaleMax }: StatsTabProps) {
  if (stats.length === 0) {
    return <p className="stats-empty">No clubs visible.</p>
  }

  return (
    <div className="stats-cards">
      {stats.map(s => (
        <ClubStatCard key={s.club} stats={s} color={colorMap[s.club]} scaleMin={scaleMin} scaleMax={scaleMax} />
      ))}
    </div>
  )
}
