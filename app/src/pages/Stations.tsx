import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { findNearbyStations, getCurrentPosition, type Station } from '../lib/stations'
import { estimateRange } from '../lib/fuel'
import { fmtKm } from '../lib/format'

export default function Stations() {
  const { state } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stations, setStations] = useState<Station[] | null>(null)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  const range = useMemo(
    () => estimateRange(state.odometerKm, state.refills, state.settings),
    [state.odometerKm, state.refills, state.settings]
  )

  const search = async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await getCurrentPosition()
      const lat = p.coords.latitude
      const lng = p.coords.longitude
      setPos({ lat, lng })
      const res = await findNearbyStations(lat, lng)
      if (res.error) setError(res.error)
      setStations(res.stations)
    } catch (e: any) {
      setError(
        e?.code === 1
          ? 'Location permission denied. Enable location access to find nearby petrol stations.'
          : e?.message ?? 'Could not get your location.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 pb-4">
      <h1 className="label-micro pt-1" style={{ fontSize: 13, color: 'var(--text)' }}>Find nearby petrol stations</h1>

      <section className="panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label-micro">Your estimated usable range</div>
            <div className="num text-3xl font-bold mt-1" style={{ color: range.low ? 'var(--amber)' : 'var(--mint)' }}>
              {range.usableRangeKm != null ? `${fmtKm(range.usableRangeKm)} km` : '—'}
            </div>
          </div>
          <button
            onClick={search}
            disabled={loading}
            className="px-5 py-3.5 rounded-xl font-semibold text-sm min-h-[48px] disabled:opacity-50"
            style={{ background: 'var(--cyan)', color: '#050810' }}
          >
            {loading ? 'Searching…' : 'Find stations'}
          </button>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
          Uses your GPS position and open map data (OpenStreetMap). Station reachability is judged against your estimated range — treat it as guidance, not a guarantee.
        </p>
      </section>

      {error && (
        <div className="panel p-3 text-sm" style={{ borderLeft: '3px solid var(--red)', color: 'var(--red)' }}>{error}</div>
      )}

      {stations && stations.length === 0 && !error && (
        <div className="panel p-6 text-center" style={{ borderStyle: 'dashed' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No petrol stations found within 8 km of this location.</p>
        </div>
      )}

      {stations?.map((s) => {
        const reachable = range.usableRangeKm != null && s.distanceKm <= range.usableRangeKm
        return (
          <div key={s.id} className="panel p-4 flex items-center gap-3">
            <span className="dot shrink-0" style={{ background: reachable ? 'var(--mint)' : 'var(--red)', boxShadow: `0 0 6px ${reachable ? 'var(--mint)' : 'var(--red)'}` }} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{s.name}</div>
              <div className="text-xs num mt-0.5" style={{ color: 'var(--muted)' }}>
                {fmtKm(s.distanceKm, 1)} km · {s.direction}
                {s.openingHours ? (s.openingHours === '24/7' ? ' · open 24/7' : ` · ${s.openingHours}`) : ''}
              </div>
            </div>
            <a
              className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-medium border min-h-[44px] inline-flex items-center"
              style={{ borderColor: 'var(--line)', color: 'var(--cyan)' }}
              href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Directions
            </a>
          </div>
        )
      })}

      {pos && (
        <p className="text-[11px] text-center num" style={{ color: 'var(--muted)' }}>
          Your position: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
        </p>
      )}

      <section className="panel p-4" style={{ borderStyle: 'dashed' }}>
        <div className="label-micro mb-1">Map view</div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          The interactive map (current position, ride routes, station pins) activates once Google Maps API credentials are configured in Settings. No API key is stored in the app's source code.
        </p>
      </section>
    </div>
  )
}
