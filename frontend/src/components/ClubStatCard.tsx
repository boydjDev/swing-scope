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

  const range = scaleMax - scaleMin || 1

  function x(yds: number): number {
    return PAD + ((yds - scaleMin) / range) * (VIEW_W - PAD * 2)
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
        <span className="club-stat-count">{count} shots</span>
      </div>

      <div className="club-stat-carry">avg distance: {avgCarry.toFixed(1)} yds</div>

      <div className="club-stat-visual">
        <span className="club-stat-edge-label">{sideLabel(stdMin)}</span>

        <div className="club-stat-svg-wrap">
          <svg width="100%" height="auto" viewBox={`0 0 ${VIEW_W} ${dynViewH}`} preserveAspectRatio="xMidYMid meet">
            {/* horizontal spread (side carry) */}
            <line x1={xMin} y1={dynCY} x2={xMax} y2={dynCY} stroke="var(--text)" strokeWidth={1} />
            <line x1={xMin} y1={dynCY - 4} x2={xMin} y2={dynCY + 4} stroke="var(--text)" strokeWidth={1} strokeLinecap="round" />
            <line x1={xMax} y1={dynCY - 4} x2={xMax} y2={dynCY + 4} stroke="var(--text)" strokeWidth={1} strokeLinecap="round" />
            <text x={labelXMin} y={dynViewH - PAD} textAnchor="middle" dominantBaseline="auto" fontSize={9} fill="var(--text)" fontFamily="var(--mono)">{sideLabel(avgSideCarry - stdSideCarry)}</text>
            <text x={labelXMax} y={dynViewH - PAD} textAnchor="middle" dominantBaseline="auto" fontSize={9} fill="var(--text)" fontFamily="var(--mono)">{sideLabel(avgSideCarry + stdSideCarry)}</text>

            {/* vertical spread (carry distance) */}
            <line x1={xZero} y1={yTop} x2={xZero} y2={yBottom} stroke="var(--text)" strokeWidth={1} />
            <line x1={xZero - 4} y1={yTop} x2={xZero + 4} y2={yTop} stroke="var(--text)" strokeWidth={1} strokeLinecap="round" />
            <line x1={xZero - 4} y1={yBottom} x2={xZero + 4} y2={yBottom} stroke="var(--text)" strokeWidth={1} strokeLinecap="round" />
            <text x={0} y={labelYTop} textAnchor="start" dominantBaseline="auto" fontSize={9} fill="var(--text)" fontFamily="var(--mono)">{`+${stdCarry.toFixed(1)}`}</text>
            <text x={0} y={dynCY} textAnchor="start" dominantBaseline="middle" fontSize={9} fill={color} fontFamily="var(--mono)">{avgCarry.toFixed(1)}</text>
            <text x={0} y={labelYBottom} textAnchor="start" dominantBaseline="hanging" fontSize={9} fill="var(--text)" fontFamily="var(--mono)">{`-${stdCarry.toFixed(1)}`}</text>

            {/* avg side carry tick */}
            <line x1={xAvg} y1={dynCY - 6} x2={xAvg} y2={dynCY + 6} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
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

      <div className="club-stat-dev">std-dev: {stdSideCarry.toFixed(1)} yds</div>
    </div>
  )
}
