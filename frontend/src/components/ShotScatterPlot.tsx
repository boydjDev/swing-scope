import { useMemo, useState } from 'react'
import '../styles/ShotScatterPlot.css'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { Session, Shot } from '../types'
import { parseSessionDate } from '../utils/parseSessionDate'
import { formatClubType } from '../utils/formatClubType'
import StatsTab, { type ClubStats } from './StatsTab'

interface ShotScatterPlotProps {
  selected: Session | null
  allSelected: boolean
  fromDate: string
  toDate: string
  shots: Shot[]
  loading: boolean
  sessionCount: number
}

const CLUB_ORDER = [
  'd',
  '1w', '2w', '3w', '4w', '5w', '6w', '7w', '9w',
  '1h', '2h', '3h', '4h', '5h', '6h',
  '1i', '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'pw', 'gw', 'aw', 'sw', 'lw',
]

const PALETTE = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316',
  '#ef4444', '#ec4899', '#8b5cf6', '#84cc16', '#14b8a6',
]

const X_DOMAIN: [number, number] = [-75, 75]
const X_TICKS = [-75, -50, -25, 0, 25, 50, 75]

function clubColor(clubType: string): string {
  const idx = CLUB_ORDER.indexOf(clubType)
  if (idx !== -1) return PALETTE[idx % PALETTE.length]
  let hash = 0
  for (const c of clubType) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[hash % PALETTE.length]
}

interface PlotShot {
  x: number
  y: number
  index: number
  shot: Shot
}

function fmtDate(iso: string): string {
  if (!iso) return '…'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function avg(shots: PlotShot[], fn: (s: Shot) => number): number {
  if (!shots.length) return 0
  return shots.reduce((sum, p) => sum + fn(p.shot), 0) / shots.length
}

export default function ShotScatterPlot({ selected, allSelected, fromDate, toDate, shots, loading, sessionCount }: ShotScatterPlotProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [minCarry, setMinCarry] = useState(0)
  const [maxCarry, setMaxCarry] = useState(300)

  function toggleClub(club: string) {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(club) ? next.delete(club) : next.add(club)
      return next
    })
  }

  const { byClub, clubTypes, colorMap } = useMemo(() => {
    if (shots.length === 0) return { byClub: {}, clubTypes: [], colorMap: {} }

    const seen = [...new Set(shots.map(s => s.club_type))]
    const clubTypes = [
      ...CLUB_ORDER.filter(c => seen.includes(c)),
      ...seen.filter(c => !CLUB_ORDER.includes(c)).sort(),
    ]

    const byClub: Record<string, PlotShot[]> = {}
    shots.forEach((s, i) => {
      if (!byClub[s.club_type]) byClub[s.club_type] = []
      byClub[s.club_type].push({ x: s.side_carry, y: s.carry_distance, index: i, shot: s })
    })

    const colorMap: Record<string, string> = {}
    clubTypes.forEach(c => { colorMap[c] = clubColor(c) })

    return { byClub, clubTypes, colorMap }
  }, [shots])

  const { scaleMin, scaleMax } = useMemo(() => {
    if (clubTypes.length === 0) return { scaleMin: -1, scaleMax: 1 }
    let min = Infinity, max = -Infinity
    for (const club of clubTypes) {
      const clubShots = byClub[club] ?? []
      if (clubShots.length === 0) continue
      const mean = clubShots.reduce((s, p) => s + p.shot.side_carry, 0) / clubShots.length
      const std = Math.sqrt(clubShots.reduce((s, p) => s + (p.shot.side_carry - mean) ** 2, 0) / clubShots.length)
      min = Math.min(min, mean - std)
      max = Math.max(max, mean + std)
    }
    return { scaleMin: min, scaleMax: max }
  }, [clubTypes, byClub])

  const stats: ClubStats[] = useMemo(() => {
    return clubTypes
      .filter(c => !hidden.has(c))
      .map(club => {
        const clubShots = byClub[club] ?? []
        return {
          club,
          count: clubShots.length,
          avgCarry:     avg(clubShots, s => s.carry_distance),
          avgTotal:     avg(clubShots, s => s.total_distance),
          avgSideCarry: avg(clubShots, s => s.side_carry),
          avgSmash:     avg(clubShots, s => s.smash_factor),
          avgBallSpeed: avg(clubShots, s => s.ball_speed),
          stdSideCarry: (() => {
            const mean = avg(clubShots, s => s.side_carry)
            const variance = clubShots.reduce((sum, p) => sum + (p.shot.side_carry - mean) ** 2, 0) / (clubShots.length || 1)
            return Math.sqrt(variance)
          })(),
          minSideCarry: Math.min(...clubShots.map(p => p.shot.side_carry)),
          maxSideCarry: Math.max(...clubShots.map(p => p.shot.side_carry)),
        }
      })
  }, [clubTypes, byClub, hidden])

  const yDomain: [number, number] = [minCarry, maxCarry]
  const chartH = 750

  if (!selected && !allSelected) {
    return (
      <p className="empty">
        {sessionCount === 0 ? 'Import a CSV to get started.' : 'Select a session to view shots.'}
      </p>
    )
  }

  if (loading) return <p className="empty">Loading…</p>
  if (shots.length === 0) return <p className="empty">No shots in this session.</p>

  return (
    <div className="scatter-wrap">
      <div className="shot-view-header">
        {allSelected ? (
          <span className="shot-view-title">
            Total Overview{fromDate || toDate ? ` · ${fmtDate(fromDate)} – ${fmtDate(toDate)}` : ''}
          </span>
        ) : (() => { const { date, time } = parseSessionDate(selected!.date); return (
          <span className="shot-view-title">{date} · {time} · {selected!.player_name}</span>
        )})()}
        <span className="shot-count">{shots.length} shots</span>
      </div>

      <div className="scatter-body">

        {/* ── Left: legend + chart ── */}
        <div className="scatter-left">
          <div className="scatter-scroll">
            <div className="club-legend">
              <div className="club-legend-actions">
                <button onClick={() => setHidden(new Set())}>All</button>
                <button onClick={() => setHidden(new Set(clubTypes))}>None</button>
              </div>
              {clubTypes.map(club => (
                <label key={club} className={`club-legend-item${hidden.has(club) ? ' hidden' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!hidden.has(club)}
                    onChange={() => toggleClub(club)}
                  />
                  <span className="club-legend-swatch" style={{ background: colorMap[club] }} />
                  {formatClubType(club)}
                </label>
              ))}
            </div>

            <div className="scatter-chart-wrap">
              <div className="scatter-title">Shot Dispersion</div>
              <ResponsiveContainer width="100%" height={chartH}>
              <ScatterChart
                margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={X_DOMAIN}
                  ticks={X_TICKS}
                  tick={{ fontSize: 11, fill: 'var(--text)', fontFamily: 'var(--mono)' }}
                  stroke="var(--border)"
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={yDomain}
                  tickCount={8}
                  tick={{ fontSize: 11, fill: 'var(--text)', fontFamily: 'var(--mono)' }}
                  stroke="var(--border)"
                  width={32}
                />
                <ReferenceLine x={0} stroke="var(--text)" strokeOpacity={0.25} strokeDasharray="5 4" />
                {clubTypes.map(club => (
                  <Scatter
                    key={club}
                    name={club}
                    data={hidden.has(club) ? [] : byClub[club]}
                    fill={colorMap[club]}
                    fillOpacity={0.8}
                    r={5}
                  />
                ))}
              </ScatterChart>
              </ResponsiveContainer>
              <div className="view-controls">
                <span className="view-controls-label">View Controls</span>
                <label className="carry-control">
                  Min
                  <input type="number" value={minCarry} min={0} step={10} onChange={e => setMinCarry(Number(e.target.value))} />
                  yds
                </label>
                <label className="carry-control">
                  Max
                  <input type="number" value={maxCarry} min={0} step={10} onChange={e => setMaxCarry(Number(e.target.value))} />
                  yds
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: stats panel ── */}
        <div className="stats-panel">
<StatsTab stats={stats} colorMap={colorMap} scaleMin={scaleMin} scaleMax={scaleMax} />
        </div>

      </div>
    </div>
  )
}
