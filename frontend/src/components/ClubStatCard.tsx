import { formatClubType } from '../utils/formatClubType'
import type { ClubStats } from './StatsTab'

interface ClubStatCardProps {
  stats: ClubStats
  color: string
  scaleMin: number
  scaleMax: number
}

const VIEW_W = 100
const VIEW_H = 40
const CY     = VIEW_H / 2
const PAD    = 4

function sideLabel(yds: number): string {
  if (Math.abs(yds) < 0.05) return '0'
  return `${Math.abs(yds).toFixed(1)}${yds < 0 ? 'L' : 'R'}`
}

export default function ClubStatCard({ stats, color, scaleMin, scaleMax }: ClubStatCardProps) {
  const { club, count, avgCarry, avgSideCarry, stdSideCarry } = stats

  const absMax = Math.max(Math.abs(scaleMin), Math.abs(scaleMax)) || 1

  function x(yds: number): number {
    return PAD + ((yds + absMax) / (absMax * 2)) * (VIEW_W - PAD * 2)
  }

  const stdMin = avgSideCarry - stdSideCarry
  const stdMax = avgSideCarry + stdSideCarry
  const xMin  = x(stdMin)
  const xMax  = x(stdMax)
  const xAvg  = x(avgSideCarry)
  const xZero = x(0)

  return (
    <div className="club-stat-card">
      <div className="club-stat-header">
        <span className="club-stat-name">
          <span className="club-stat-swatch" style={{ background: color }} />
          {formatClubType(club)}
        </span>
        <span className="club-stat-count" style={count === 1 ? { color: '#ef4444' } : count < 10 ? { color: '#eab308' } : undefined}>{count} shots</span>
      </div>

      <div className="club-stat-carry">avg distance: {avgCarry.toFixed(1)} yds</div>

      <div className="club-stat-visual">
        <span className="club-stat-edge-label">{sideLabel(stdMin)}</span>

        <div className="club-stat-svg-wrap">
          <svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
            {/* spread line */}
            <line x1={xMin} y1={CY} x2={xMax} y2={CY} stroke="var(--text)" strokeWidth={1} />

            {/* left cap */}
            <line x1={xMin} y1={CY - 5} x2={xMin} y2={CY + 5} stroke="var(--text)" strokeWidth={1} strokeLinecap="round" />

            {/* right cap */}
            <line x1={xMax} y1={CY - 5} x2={xMax} y2={CY + 5} stroke="var(--text)" strokeWidth={1} strokeLinecap="round" />

            {/* zero tick */}
            {xZero >= PAD && xZero <= VIEW_W - PAD && (
              <line x1={xZero} y1={CY - 11} x2={xZero} y2={CY + 11} stroke="var(--text-h)" strokeWidth={0.8} strokeLinecap="round" />
            )}

            {/* avg tick */}
            <line x1={xAvg} y1={CY - 9} x2={xAvg} y2={CY + 9} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
          </svg>
          <span
            className="club-stat-avg-label"
            style={{ left: `${(xAvg / VIEW_W) * 100}%` }}
          >
            {avgSideCarry.toFixed(1)}
          </span>
        </div>

        <span className="club-stat-edge-label">{sideLabel(stdMax)}</span>
      </div>

      <div className="club-stat-dev">std-dev: ±{stdSideCarry.toFixed(1)} yds</div>
    </div>
  )
}
