import React, { useMemo, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../styles/ShotScatterPlot.css'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  type Plugin,
} from 'chart.js'
import { Scatter } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import type { Session, Shot } from '../types'
import { parseSessionDate } from '../utils/parseSessionDate'
import { formatClubType } from '../utils/formatClubType'
import StatsTab, { type ClubStats } from './StatsTab'

ChartJS.register(LinearScale, PointElement, Tooltip, zoomPlugin)

interface ShotScatterPlotProps {
  selected: Session | null
  allSelected: boolean
  fromDate: string
  toDate: string
  shots: Shot[]
  loading: boolean
  sessionCount: number
  theme: 'light' | 'dark'
  onShotDeleted: (id: number) => void
}

const CLUB_ORDER = [
  'd',
  '1w', '2w', '3w', '4w', '5w', '6w', '7w', '9w',
  '1h', '2h', '3h', '4h', '5h', '6h',
  '1i', '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'pw', 'gw', 'aw', 'sw', 'lw',
  'ot',
]

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Golden-angle hue distribution — each step is 137.5° apart, guaranteeing
// maximum perceptual separation for any number of colors.
const PALETTE = Array.from({ length: CLUB_ORDER.length }, (_, i) =>
  hslToHex((i * 137.508) % 360, 70, 55)
)

function clubColor(club: string): string {
  const idx = CLUB_ORDER.indexOf(club)
  if (idx !== -1) return PALETTE[idx]
  // unknown club type — hash to a palette color
  let hash = 0
  for (const c of club) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return PALETTE[hash % PALETTE.length]
}

const X_DOMAIN: [number, number] = [-75, 75]
const MONO = 'ui-monospace, Consolas, monospace'


function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function makeDeviationPlugin(
  statsRef: React.RefObject<ClubStats[]>,
  colorMapRef: React.RefObject<Record<string, string>>,
  showRef: React.RefObject<boolean>,
): Plugin<'scatter'> {
  return {
    id: 'deviationLines',
    beforeDatasetsDraw(chart) {
      if (!showRef.current) return
      const { ctx, scales } = chart
      const sx = Math.abs(scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0))
      const sy = Math.abs(scales.y.getPixelForValue(1) - scales.y.getPixelForValue(0))
      for (const s of statsRef.current ?? []) {
        const color = (colorMapRef.current ?? {})[s.club]
        const cx = scales.x.getPixelForValue(s.medianSideCarry)
        const cy = scales.y.getPixelForValue(s.medianCarry)
        // transform covariance matrix to pixel space
        const a = s.stdSideCarry ** 2 * sx * sx
        const c = s.stdCarry ** 2 * sy * sy
        const b = -s.covCarry * sx * sy
        // eigendecomposition of [[a,b],[b,c]]
        const trace = a + c
        const disc  = Math.sqrt(Math.max(0, ((a - c) / 2) ** 2 + b * b))
        const semiMajor = Math.sqrt(Math.max(0, trace / 2 + disc)) * 1.8
        const semiMinor = Math.sqrt(Math.max(0, trace / 2 - disc)) * 1.8
        const angle = Math.atan2(2 * b, a - c) / 2
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.ellipse(cx, cy, semiMajor, semiMinor, angle, 0, 2 * Math.PI)
        ctx.stroke()
        // centre dot
        ctx.globalAlpha = 1
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, 3, 0, 2 * Math.PI)
        ctx.fill()
        ctx.restore()
      }
    },
  }
}

function makeHighlightPlugin(selectedRef: React.RefObject<Shot | null>): Plugin<'scatter'> {
  return {
    id: 'highlight',
    afterDatasetsDraw(chart) {
      const shot = selectedRef.current
      if (!shot) return
      const { ctx } = chart
      for (let di = 0; di < chart.data.datasets.length; di++) {
        const data = chart.data.datasets[di].data as unknown as { shot: Shot }[]
        for (let i = 0; i < data.length; i++) {
          if (data[i]?.shot?.id === shot.id) {
            const pt = chart.getDatasetMeta(di).data[i]
            if (!pt) return
            ctx.save()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, 9, 0, 2 * Math.PI)
            ctx.stroke()
            ctx.restore()
            return
          }
        }
      }
    },
  }
}

const refLinePlugin: Plugin<'scatter'> = {
  id: 'refLine',
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart
    const x = scales.x.getPixelForValue(0)
    const { top, bottom } = scales.y
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.strokeStyle = getCssVar('--text-h') + '40'
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  },
}

interface PlotShot {
  x: number
  y: number
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

function median(shots: PlotShot[], fn: (s: Shot) => number): number {
  if (!shots.length) return 0
  const sorted = shots.map(p => fn(p.shot)).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export default function ShotScatterPlot({ selected, allSelected, fromDate, toDate, shots, loading, sessionCount, theme, onShotDeleted }: ShotScatterPlotProps) {
  const chartRef = useRef<ChartJS<'scatter'>>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showEllipse, setShowEllipse] = useState(true)
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
    shots.forEach(s => {
      if (!byClub[s.club_type]) byClub[s.club_type] = []
      byClub[s.club_type].push({ x: s.side_carry, y: s.carry_distance, shot: s })
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
        const sideMean = avg(clubShots, s => s.side_carry)
        const sideVariance = clubShots.reduce((sum, p) => sum + (p.shot.side_carry - sideMean) ** 2, 0) / (clubShots.length || 1)
        const carryMean = avg(clubShots, s => s.carry_distance)
        const carryVariance = clubShots.reduce((sum, p) => sum + (p.shot.carry_distance - carryMean) ** 2, 0) / (clubShots.length || 1)
        const covCarry = clubShots.reduce((sum, p) => sum + (p.shot.side_carry - sideMean) * (p.shot.carry_distance - carryMean), 0) / (clubShots.length || 1)
        return {
          club,
          count: clubShots.length,
          avgCarry:        carryMean,
          stdCarry:        Math.sqrt(carryVariance),
          avgSideCarry:    sideMean,
          stdSideCarry:    Math.sqrt(sideVariance),
          covCarry,
          medianCarry:     median(clubShots, s => s.carry_distance),
          medianSideCarry: median(clubShots, s => s.side_carry),
        }
      })
  }, [clubTypes, byClub, hidden])

  const carryScale = useMemo(() => {
    if (clubTypes.length === 0) return 1
    let max = 1
    for (const club of clubTypes) {
      const clubShots = byClub[club] ?? []
      if (clubShots.length === 0) continue
      const mean = clubShots.reduce((s, p) => s + p.shot.carry_distance, 0) / clubShots.length
      const std = Math.sqrt(clubShots.reduce((s, p) => s + (p.shot.carry_distance - mean) ** 2, 0) / clubShots.length)
      max = Math.max(max, std)
    }
    return max
  }, [clubTypes, byClub])

  const statsRef    = useRef<ClubStats[]>(stats)
  statsRef.current  = stats
  const colorMapRef = useRef<Record<string, string>>(colorMap)
  colorMapRef.current = colorMap
  const showEllipseRef = useRef(showEllipse)
  showEllipseRef.current = showEllipse
  const deviationPlugin = useMemo(() => makeDeviationPlugin(statsRef, colorMapRef, showEllipseRef), [])

  const selectedShotRef = useRef<Shot | null>(selectedShot)
  selectedShotRef.current = selectedShot
  const highlightPlugin = useMemo(() => makeHighlightPlugin(selectedShotRef), [])

  if (!selected && !allSelected) {
    return (
      <p className="empty">
        {sessionCount === 0 ? 'Import a CSV to get started.' : 'Select a session to view shots.'}
      </p>
    )
  }

  if (loading) return <p className="empty">Loading…</p>
  if (shots.length === 0) return <p className="empty">No shots in this session.</p>

  const borderColor = getCssVar('--border')
  const textColor   = getCssVar('--text')

  ChartJS.defaults.color       = textColor
  ChartJS.defaults.borderColor = borderColor

  const chartData = {
    datasets: clubTypes.map(club => ({
      label: club,
      data: hidden.has(club) ? [] : byClub[club].map(p => ({ x: p.x, y: p.y, shot: p.shot })),
      backgroundColor: colorMap[club] + 'cc',
      borderWidth: 0,
      pointRadius: 5,
      pointHoverRadius: 7,
    })),
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    onClick: (_: unknown, elements: { datasetIndex: number; index: number }[]) => {
      if (elements.length > 0) {
        const { datasetIndex, index } = elements[0]
        const point = chartData.datasets[datasetIndex].data[index] as unknown as { shot: Shot }
        setSelectedShot(point.shot)
      } else {
        setSelectedShot(null)
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: X_DOMAIN[0],
        max: X_DOMAIN[1],
        ticks: {
          stepSize: 25,
          color: textColor,
          font: { family: MONO, size: 11 },
        },
        grid: { color: borderColor },
        border: { color: borderColor },
      },
      y: {
        type: 'linear' as const,
        min: 0,
        suggestedMax: 275,
        ticks: {
          count: 8,
          color: textColor,
          font: { family: MONO, size: 11 },
        },
        grid: { color: borderColor },
        border: { color: borderColor },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      zoom: {
        pan: { enabled: true, mode: 'xy' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: false }, mode: 'xy' as const },
      },
    },
    events: ['click', 'mousemove', 'mousedown', 'mouseup', 'wheel'] as (keyof HTMLElementEventMap)[],
  }

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
              <div style={{ flex: 1, minHeight: 400 }}>
                <Scatter key={theme} ref={chartRef} data={chartData} options={chartOptions} plugins={[deviationPlugin, highlightPlugin, refLinePlugin]} />
              </div>
              <div className="reset-wrap">
                <button className="reset-zoom" onClick={() => { setShowEllipse(v => !v); chartRef.current?.update() }}>{showEllipse ? 'Hide' : 'Show'} Ellipses</button>
                <button className="reset-zoom" onClick={() => chartRef.current?.resetZoom()}>Reset View</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: stats panel ── */}
        <div className="stats-panel">
          <StatsTab stats={stats} colorMap={colorMap} scaleMin={scaleMin} scaleMax={scaleMax} carryScale={carryScale} />
        </div>

      </div>

      {selectedShot && (
        <div className="shot-delete-panel">
          <button className="shot-delete-dismiss" onClick={() => { setSelectedShot(null); setConfirmDelete(false) }}>✕</button>
          <div className="shot-delete-title">{formatClubType(selectedShot.club_type)}</div>
          <div className="shot-delete-stats">
            <span>Carry:      {selectedShot.carry_distance.toFixed(1)} yds</span>
            <span>Total:      {selectedShot.total_distance.toFixed(1)} yds</span>
            <span>Side Carry: {selectedShot.side_carry.toFixed(1)} yds</span>
            <span>Ball Speed: {selectedShot.ball_speed.toFixed(1)} mph</span>
            <span>Club Speed: {selectedShot.club_speed.toFixed(1)} mph</span>
            <span>Smash:      {selectedShot.smash_factor.toFixed(2)}</span>
            <span>Launch:     {selectedShot.launch_angle.toFixed(1)}°</span>
            <span>Direction:  {selectedShot.launch_direction.toFixed(1)}°</span>
            <span>Apex:       {selectedShot.apex.toFixed(0)} yds</span>
            <span>Descent:    {selectedShot.descent_angle.toFixed(1)}°</span>
            <span>Attack:     {selectedShot.attack_angle.toFixed(1)}°</span>
            <span>Club Path:  {selectedShot.club_path.toFixed(1)}°</span>
            <span>Spin:       {Math.round(selectedShot.spin_rate)} rpm</span>
            <span>Spin Axis:  {selectedShot.spin_axis.toFixed(1)}°</span>
          </div>
          {confirmDelete ? (
            <div className="shot-delete-confirm">
              <div className="shot-delete-confirm-actions">
                <button className="shot-delete-btn" onClick={async () => {
                  await invoke('delete_shot', { shotId: selectedShot.id })
                  onShotDeleted(selectedShot.id)
                  setSelectedShot(null)
                  setConfirmDelete(false)
                  chartRef.current?.update()
                }}>Confirm</button>
                <button className="shot-delete-cancel" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="shot-delete-btn" onClick={() => setConfirmDelete(true)}>Remove Shot</button>
          )}
        </div>
      )}
    </div>
  )
}
