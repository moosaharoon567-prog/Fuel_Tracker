import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { fmtKm, fmtDuration, fmtDateTime } from '../lib/format'
import { Stat, RouteMap } from '../components/bits'
import type { Ride } from '../lib/types'

type FilterKey =
  | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'
  | 'dow0' | 'dow1' | 'dow2' | 'dow3' | 'dow4' | 'dow5' | 'dow6'
  | 'custom' | 'all'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'dow1', label: 'Mon' },
  { key: 'dow2', label: 'Tue' },
  { key: 'dow3', label: 'Wed' },
  { key: 'dow4', label: 'Thu' },
  { key: 'dow5', label: 'Fri' },
  { key: 'dow6', label: 'Sat' },
  { key: 'dow0', label: 'Sun' },
  { key: 'custom', label: 'Custom' },
  { key: 'all', label: 'All time' },
]

function startOfDay(ts: number) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }
function startOfWeek(ts: number) { const d = new Date(ts); const dow = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); return d.getTime() - dow * 86400000 }
function startOfMonth(ts: number) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime() }

export default function Rides() {
  const { state, dispatch } = useStore()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rides = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000
    const sorted = [...state.rides].sort((a, b) => b.startTs - a.startTs)
    switch (filter) {
      case 'all': return sorted
      case 'today': { const t0 = startOfDay(now); return sorted.filter((r) => r.startTs >= t0) }
      case 'yesterday': { const t0 = startOfDay(now) - DAY; const t1 = startOfDay(now); return sorted.filter((r) => r.startTs >= t0 && r.startTs < t1) }
      case 'thisWeek': { const t0 = startOfWeek(now); return sorted.filter((r) => r.startTs >= t0) }
      case 'lastWeek': { const t0 = startOfWeek(now) - 7 * DAY; const t1 = startOfWeek(now); return sorted.filter((r) => r.startTs >= t0 && r.startTs < t1) }
      case 'thisMonth': { const t0 = startOfMonth(now); return sorted.filter((r) => r.startTs >= t0) }
      case 'lastMonth': { const t0 = startOfMonth(now); const d = new Date(t0); d.setMonth(d.getMonth() - 1); return sorted.filter((r) => r.startTs >= d.getTime() && r.startTs < t0) }
      case 'custom': {
        const t0 = from ? startOfDay(new Date(from).getTime()) : 0
        const t1 = to ? startOfDay(new Date(to).getTime()) + DAY : Infinity
        return sorted.filter((r) => r.startTs >= t0 && r.startTs < t1)
      }
      default: {
        const dow = Number(filter.slice(3))
        return sorted.filter((r) => new Date(r.startTs).getDay() === dow)
      }
    }
  }, [state.rides, filter, from, to])

  const stats = useMemo(() => {
    const dist = rides.reduce((s, r) => s + r.distanceKm, 0)
    const time = rides.reduce((s, r) => s + r.durationSec, 0)
    const longest = rides.reduce((m, r) => Math.max(m, r.distanceKm), 0)
    return { dist, time, longest, count: rides.length, avg: rides.length ? dist / rides.length : 0 }
  }, [rides])

  return (
    <div className="space-y-3 pb-4">
      <h1 className="label-micro pt-1" style={{ fontSize: 13, color: 'var(--text)' }}>Distance history</h1>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="shrink-0 px-3.5 py-2.5 rounded-full text-xs font-medium border min-h-[44px]"
            style={
              filter === f.key
                ? { background: 'var(--cyan)', borderColor: 'var(--cyan)', color: '#050810' }
                : { background: 'var(--panel)', borderColor: 'var(--line)', color: 'var(--muted)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="panel-2 px-3 py-3 text-sm num [color-scheme:dark]" style={{ color: 'var(--text)' }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="panel-2 px-3 py-3 text-sm num [color-scheme:dark]" style={{ color: 'var(--text)' }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total distance" value={fmtKm(stats.dist, 1)} unit="km" accent="var(--cyan)" />
        <Stat label="Rides" value={String(stats.count)} />
        <Stat label="Avg ride" value={fmtKm(stats.avg, 1)} unit="km" />
        <Stat label="Longest ride" value={fmtKm(stats.longest, 1)} unit="km" />
        <Stat label="Riding time" value={fmtDuration(stats.time)} />
      </div>

      {rides.length === 0 && (
        <div className="panel p-6 text-center border-dashed" style={{ borderStyle: 'dashed' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No rides in this period. Press Start ride on the dashboard to track one.</p>
        </div>
      )}

      <div className="space-y-2">
        {rides.map((r: Ride) => (
          <div key={r.id} className="panel overflow-hidden">
            <button className="w-full p-4 text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
              <div className="flex items-baseline justify-between">
                <span className="num text-xl font-semibold">{fmtKm(r.distanceKm, 2)} <span className="text-xs" style={{ color: 'var(--muted)' }}>km</span></span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{fmtDateTime(r.startTs)}</span>
              </div>
              <div className="mt-1 text-xs num" style={{ color: 'var(--muted)' }}>
                {fmtDuration(r.durationSec)} · avg {fmtKm(r.avgSpeedKmh)} km/h · max {fmtKm(r.maxSpeedKmh)} km/h
              </div>
            </button>
            {openId === r.id && (
              <div className="px-4 pb-4 space-y-3">
                <RouteMap points={r.points} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="panel-2 p-2"><div className="label-micro">Hard accel</div><div className="num font-semibold mt-0.5">{r.hardAccelCount}</div></div>
                  <div className="panel-2 p-2"><div className="label-micro">Hard brake</div><div className="num font-semibold mt-0.5">{r.hardBrakeCount}</div></div>
                  <div className="panel-2 p-2"><div className="label-micro">Stopped</div><div className="num font-semibold mt-0.5">{Math.round(r.stopRatio * 100)}%</div></div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'DELETE_RIDE', id: r.id })}
                  className="w-full py-3 rounded-xl text-sm border min-h-[44px]"
                  style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                >
                  Delete ride (removes its distance)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
