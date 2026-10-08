import { useMemo, useState } from 'react'
import { useStore, finalizeRide } from '../lib/store'
import { useRideTracker } from '../hooks/useRideTracker'
import { useNow } from '../hooks/useNow'
import { estimateRange, learnMileage, currentCycleEfficiency, distanceSinceLastRefill } from '../lib/fuel'
import { fmtKm, fmtL, fmtEff, fmtDuration, fmtDateTime } from '../lib/format'
import { Stat, RouteMap } from '../components/bits'
import { RefillSheet } from '../components/RefillSheet'

export default function Dashboard() {
  const { state, dispatch } = useStore()
  const { startRide } = useRideTracker()
  const [refillOpen, setRefillOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const ride = state.activeRide
  const now = useNow(1000, ride != null)

  const range = useMemo(
    () => estimateRange(state.odometerKm, state.refills, state.settings),
    [state.odometerKm, state.refills, state.settings]
  )
  const learned = useMemo(() => learnMileage(state.refills, state.settings), [state.refills, state.settings])
  const cycleNow = currentCycleEfficiency(state.odometerKm, state.refills)
  const cycleDist = distanceSinceLastRefill(state.odometerKm, state.refills)
  const todayKm = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const t0 = d.getTime()
    return state.rides.filter((r) => r.endTs >= t0).reduce((s, r) => s + r.distanceKm, 0) + (ride?.distanceKm ?? 0)
  }, [state.rides, ride, now])
  const lastRefill = state.refills.length ? [...state.refills].sort((a, b) => b.ts - a.ts)[0] : null

  const rangeColor =
    range.usableRangeKm == null ? 'var(--muted)' : range.usableRangeKm <= 0 ? 'var(--red)' : range.low ? 'var(--amber)' : 'var(--mint)'

  const elapsedSec = ride ? Math.max(0, Math.round((now - ride.startTs) / 1000)) : 0

  return (
    <div className="space-y-3 pb-4">
      {/* Low fuel alert */}
      {range.low && range.usableRangeKm != null && (
        <div className="panel p-3 flex items-start gap-3" style={{ borderLeft: '3px solid var(--amber)' }}>
          <span className="dot mt-1.5" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--amber)' }}>Fuel range getting low</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Estimated usable range is below {state.settings.lowFuelWarnKm} km. Plan a refill — check Nearby Stations.
            </div>
          </div>
        </div>
      )}

      {/* HERO: estimated remaining range */}
      <section className="panel p-5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="label-micro">Est. remaining range</span>
          <span className="label-micro px-2 py-0.5 rounded border" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            estimate
          </span>
        </div>
        <div className="num font-bold leading-none mt-2" style={{ fontSize: 'clamp(56px, 18vw, 96px)', color: rangeColor }}>
          {range.usableRangeKm != null ? fmtKm(range.usableRangeKm) : '—'}
          <span className="text-2xl font-medium ml-2" style={{ color: 'var(--muted)' }}>km</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Est. fuel: <span className="num" style={{ color: 'var(--text)' }}>{fmtL(range.estFuelLiters)} L</span></span>
          <span>Theoretical: <span className="num" style={{ color: 'var(--text)' }}>{fmtKm(range.theoreticalRangeKm)} km</span></span>
          <span>Reserve: <span className="num" style={{ color: 'var(--text)' }}>{fmtKm(state.settings.reserveKm)} km</span></span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          {range.basis} GPS error, traffic, riding style, road and bike condition can change the real result.
        </p>
      </section>

      {/* Active ride panel */}
      {ride && (
        <section className="panel p-4" style={{ borderColor: 'var(--cyan)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`dot ${ride.gpsActive ? 'dot-live' : ''}`} style={ride.gpsActive ? undefined : { background: 'var(--red)' }} />
              <span className="label-micro" style={{ color: ride.gpsActive ? 'var(--mint)' : 'var(--red)' }}>
                {ride.permissionDenied ? 'Location permission denied' : ride.gpsActive ? 'GPS tracking' : 'Waiting for GPS…'}
              </span>
            </div>
            <span className="label-micro">{fmtDuration(elapsedSec)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="label-micro">Ride distance</div>
              <div className="num text-4xl font-bold mt-1">{fmtKm(ride.distanceKm, 2)}<span className="text-sm ml-1" style={{ color: 'var(--muted)' }}>km</span></div>
            </div>
            <div>
              <div className="label-micro">Speed</div>
              <div className="num text-4xl font-bold mt-1" style={{ color: 'var(--cyan)' }}>
                {ride.currentSpeedKmh != null ? fmtKm(ride.currentSpeedKmh) : '—'}
                <span className="text-sm ml-1" style={{ color: 'var(--muted)' }}>km/h</span>
              </div>
            </div>
          </div>
          {ride.permissionDenied && (
            <p className="mt-3 text-xs" style={{ color: 'var(--red)' }}>
              Location permission is required to track distance. Enable it in your browser settings, then restart the ride.
            </p>
          )}
          <p className="mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>
            PWA limitation: browsers may pause GPS when the screen is locked or the app is backgrounded. Keep the app open for accurate tracking.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => setConfirmStop(true)}
              className="py-4 rounded-xl font-semibold text-base"
              style={{ background: 'var(--red)', color: '#050810' }}
            >
              Stop ride
            </button>
            <button
              onClick={() => dispatch({ type: 'DISCARD_RIDE' })}
              className="py-4 rounded-xl font-medium text-sm border"
              style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      {/* Actions */}
      {!ride && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={startRide}
            className="py-4 rounded-xl font-semibold text-base min-h-[56px]"
            style={{ background: 'var(--mint)', color: '#050810' }}
          >
            ▶ Start ride
          </button>
          <button
            onClick={() => setRefillOpen(true)}
            className="py-4 rounded-xl font-semibold text-base min-h-[56px]"
            style={{ background: 'var(--cyan)', color: '#050810' }}
          >
            ⛽ {state.refills.length === 0 ? 'Record fuel' : 'Add fuel'}
          </button>
        </div>
      )}
      {ride && (
        <button
          onClick={() => setRefillOpen(true)}
          className="w-full py-3.5 rounded-xl font-semibold text-base border"
          style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
        >
          ⛽ Add fuel during ride
        </button>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Today" value={fmtKm(todayKm, 1)} unit="km" />
        <Stat label="Fuel-cycle distance" value={fmtKm(cycleDist, 1)} unit="km" />
        <Stat
          label="Learned avg mileage"
          value={fmtEff(learned.efficiency)}
          unit="km/L"
          accent="var(--cyan)"
          sub={learned.source === 'provisional' ? 'provisional' : learned.cycleCount ? `${learned.cycleCount} cycle${learned.cycleCount === 1 ? '' : 's'}` : 'no cycles yet'}
        />
        <Stat label="This cycle mileage" value={fmtEff(cycleNow)} unit="km/L" sub="live estimate" />
      </div>

      {/* Last refill */}
      <section className="panel p-4">
        <div className="label-micro mb-2">Last refill</div>
        {lastRefill ? (
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="num text-2xl font-semibold">{lastRefill.liters.toFixed(2)} L</span>
              {lastRefill.fullTank && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }}>FULL</span>
              )}
            </div>
            <div className="text-right text-xs" style={{ color: 'var(--muted)' }}>
              <div>{fmtDateTime(lastRefill.ts)}</div>
              {lastRefill.cycleEfficiency != null && (
                <div className="num mt-0.5">{lastRefill.cycleDistanceKm!.toFixed(0)} km → {lastRefill.cycleEfficiency.toFixed(1)} km/L</div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No fuel recorded yet. Record your current fuel to start learning your bike's real mileage.
          </p>
        )}
      </section>

      <RefillSheet open={refillOpen} onClose={() => setRefillOpen(false)} />

      {/* Stop confirmation */}
      {confirmStop && ride && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmStop(false)} />
          <div className="relative w-full sm:max-w-md panel p-5" style={{ borderRadius: '18px 18px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
            <div className="label-micro mb-3" style={{ fontSize: 12, color: 'var(--text)' }}>End this ride?</div>
            <div className="panel-2 p-3 mb-3">
              <RouteMap points={ride.points} height={110} />
              <div className="flex justify-between mt-2 text-sm">
                <span className="num font-semibold">{fmtKm(ride.distanceKm, 2)} km</span>
                <span className="num" style={{ color: 'var(--muted)' }}>{fmtDuration(elapsedSec)} · max {fmtKm(ride.maxSpeedKmh)} km/h</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  dispatch({ type: 'STOP_RIDE', ride: finalizeRide(ride) })
                  setConfirmStop(false)
                }}
                className="py-4 rounded-xl font-semibold"
                style={{ background: 'var(--mint)', color: '#050810' }}
              >
                Save ride
              </button>
              <button
                onClick={() => setConfirmStop(false)}
                className="py-4 rounded-xl font-medium border"
                style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
              >
                Keep riding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
