import type { Session, Shot } from '../types'

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

interface ShotTableProps {
  selected: Session | null
  shots: Shot[]
  loading: boolean
  sessionCount: number
}

export default function ShotTable({ selected, shots, loading, sessionCount }: ShotTableProps) {
  if (!selected) {
    return (
      <p className="empty">
        {sessionCount === 0 ? 'Import a CSV to get started.' : 'Select a session to view shots.'}
      </p>
    )
  }

  if (loading) {
    return <p className="empty">Loading…</p>
  }

  return (
    <>
      <div className="shot-view-header">
        <span className="shot-view-title">{selected.player_name} — {selected.date}</span>
        <span className="shot-count">{shots.length} shots</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Club</th>
              <th>Model</th>
              <th>Carry</th>
              <th>Total</th>
              <th>Ball Spd</th>
              <th>Club Spd</th>
              <th>Smash</th>
              <th>Lnch Ang</th>
              <th>Lnch Dir</th>
              <th>Apex</th>
              <th>Side</th>
              <th>Descent</th>
              <th>Attack</th>
              <th>Path</th>
              <th>Spin</th>
              <th>Axis</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((s, i) => (
              <tr key={i} className={s.club_data_est ? 'estimated' : ''}>
                <td className="num">{i + 1}</td>
                <td>{s.club_type}</td>
                <td className="model">{s.club_model}</td>
                <td className="num">{fmt(s.carry_distance)}</td>
                <td className="num">{fmt(s.total_distance)}</td>
                <td className="num">{fmt(s.ball_speed)}</td>
                <td className="num">{fmt(s.club_speed)}</td>
                <td className="num">{fmt(s.smash_factor, 2)}</td>
                <td className="num">{fmt(s.launch_angle)}</td>
                <td className="num">{fmt(s.launch_direction)}</td>
                <td className="num">{fmt(s.apex)}</td>
                <td className="num">{fmt(s.side_carry)}</td>
                <td className="num">{fmt(s.descent_angle)}</td>
                <td className="num">{fmt(s.attack_angle)}</td>
                <td className="num">{fmt(s.club_path)}</td>
                <td className="num">{fmt(s.spin_rate, 0)}</td>
                <td className="num">{fmt(s.spin_axis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
