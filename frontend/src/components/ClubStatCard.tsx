import { formatClubType } from '../utils/formatClubType'
import type { ClubStats } from './StatsTab'

interface ClubStatCardProps {
  stats: ClubStats
  color: string
  scaleMin: number
  scaleMax: number
  carryScale: number
}

const VIEW_W       = 200
const PAD          = 6   // inner buffer between plot lines and label area
const H_MARGIN     = 35  // horizontal reserved space (left/right) for side-carry labels
const V_MARGIN_TOP = 10  // vertical space above plot
const V_MARGIN_BOT = 22  // vertical space below plot (larger for horizontal labels)
const SCALE_HALF_H = 59  // pixel half-height at full carryScale

function sideLabel(yds: number): string {
  if (Math.abs(yds) < 0.05) return '0'
  return `${yds > 0 ? '+' : ''}${yds.toFixed(1)}`
}

export default function ClubStatCard({ stats, color, scaleMin, scaleMax, carryScale }: ClubStatCardProps) {
  const { club, count, avgCarry, stdCarry, avgSideCarry, stdSideCarry } = stats

  const absMax   = Math.max(Math.abs(scaleMin), Math.abs(scaleMax)) || 1
  const dataHalf = SCALE_HALF_H * (stdCarry / carryScale)
  const dynCY    = dataHalf + V_MARGIN_TOP + PAD
  const dynViewH = dynCY + dataHalf + V_MARGIN_BOT + PAD

  function x(yds: number): number {
    return H_MARGIN + PAD + ((yds + absMax) / (absMax * 2)) * (VIEW_W - (H_MARGIN + PAD) * 2)
  }

  function y(dev: number): number {
    return dynCY - (dev / carryScale) * SCALE_HALF_H
  }

  const xMin  = x(avgSideCarry - stdSideCarry)
  const xMax  = x(avgSideCarry + stdSideCarry)

  const MIN_V_SEP = 22
  const labelYTop    = dynCY - Math.max(dataHalf, MIN_V_SEP / 2)
  const labelYBottom = dynCY + Math.max(dataHalf, MIN_V_SEP / 2)

  const MIN_H_SEP = 40
  const hMid      = (xMin + xMax) / 2
  const hHalf     = Math.max((xMax - xMin) / 2, MIN_H_SEP / 2)
  const labelXMin = hMid - hHalf
  const labelXMax = hMid + hHalf
  const xAvg  = x(avgSideCarry)
  const xZero = x(0)
  const yTop    = y(stdCarry)
  const yBottom = y(-stdCarry)

  return (
    <div className="club-stat-card">
      <div className="club-stat-header">
        <span className="club-stat-name">
          <span className="club-stat-swatch" style={{ background: color }} />
          {formatClubType(club)}
        </span>
        <span className="club-stat-count" style={count === 1 ? { color: '#ef4444' } : count < 10 ? { color: '#eab308' } : undefined}>{count} shots</span>
      </div>

      <div className="club-stat-carry"><span>Carry:</span><span>{avgCarry.toFixed(1)} yds</span></div>
      <div className="club-stat-carry"><span>Side:</span><span>{sideLabel(avgSideCarry)} yds</span></div>

      <div className="club-stat-visual">
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
            <text x={0} y={labelYBottom} textAnchor="start" dominantBaseline="hanging" fontSize={9} fill="var(--text)" fontFamily="var(--mono)">{`-${stdCarry.toFixed(1)}`}</text>

            {/* avg side carry tick */}
            <line x1={xAvg} y1={dynCY - 6} x2={xAvg} y2={dynCY + 6} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </div>
      </div>


    </div>
  )
}

//      <div className="club-stat-carry">avg side carry: {sideLabel(avgSideCarry)}</div>
//      <div className="club-stat-dev">side std-dev: ±{stdSideCarry.toFixed(1)} yds</div>
//      <div className="club-stat-dev">carry std-dev: ±{stdCarry.toFixed(1)} yds</div>