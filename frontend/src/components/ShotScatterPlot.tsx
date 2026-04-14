import { useMemo, useState } from 'react'
import '../styles/ShotScatterPlot.css'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { Session, Shot } from '../types'
import { formatClubType } from '../utils/formatClubType'
import { parseSessionDate } from '../utils/parseSessionDate'

interface ShotScatterPlotProps {
  selected: Session | null
  allSelected: boolean
  fromDate: string
  toDate: string
  shots: Shot[]
  loading: boolean
  sessionCount: number
}

// Raw club_type values ordered longest → shortest for color palette assignment
const CLUB_ORDER = [
  'd',
  '1w', '2w', '3w', '4w', '5w', '6w', '7w', '9w',
  '1h', '2h', '3h', '4h', '5h', '6h',
  '1i', '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'pw', 'gw', 'aw', 'sw', 'lw',
]

const PALETTE = [
  '#3b82f6', // blue     – driver
  '#06b6d4', // cyan     – woods
  '#10b981', // emerald  – hybrids
  '#f59e0b', // amber    – long irons
  '#f97316', // orange   – mid irons
  '#ef4444', // red      – short irons
  '#ec4899', // pink     – wedges
  '#8b5cf6', // violet
  '#84cc16', // lime
  '#14b8a6', // teal
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

// "2026-04-01" → "Apr 1, 2026", "" → "…"
function fmtDate(iso: string): string {
  if (!iso) return '…'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

  const yDomain: [number, number] = [minCarry, maxCarry]
  const PX_PER_YD = 3.5
  const chartW = (X_DOMAIN[1] - X_DOMAIN[0]) * PX_PER_YD
  const chartH = 600

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
          <ScatterChart
            width={chartW}
            height={chartH}
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
          <div className="view-controls">
            <span className="view-controls-label">View Controls</span>
            <label className="carry-control">
              Min
              <input
                type="number"
                value={minCarry}
                min={0}
                step={10}
                onChange={e => setMinCarry(Number(e.target.value))}
              />
              yds
            </label>
            <label className="carry-control">
              Max
              <input
                type="number"
                value={maxCarry}
                min={0}
                step={10}
                onChange={e => setMaxCarry(Number(e.target.value))}
              />
              yds
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
