import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { learnMileage, behaviorSummary, currentCycleEfficiency } from '../lib/fuel'
import { fmtEff, fmtKm, fmtDateTime, fmtL } from '../lib/format'
import { Stat } from '../components/bits'
import { RefillSheet } from '../components/RefillSheet'

export default function Fuel() {
  const { state, dispatch } = useStore()
  const [refillOpen, setRefillOpen] = useState(false)
  const learned = useMemo(() => learnMileage(state.refills, state.settings), [state.refills, state.settings])
  const behavior = useMemo(() => behaviorSummary(state.rides), [state.rides])
  const cycleNow = currentCycleEfficiency(state.odometerKm, state.refills)
  const refills = [...state.refills].sort((a, b) => b.ts - a.ts)
  const cur = state.settings.currency

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between pt-1">
        <h1 className="label-micro" style={{ fontSize: 13, color: 'var(--text)' }}>Fuel & mileage</h1>
        <button
          onClick={() => setRefillOpen(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px]"
          style={{ background: 'var(--cyan)', color: '#050810' }}
        >
          + Refill
        </button>
      </div>

      {/* Mileage learning */}
      <section className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label-micro">Learned mileage</span>
          <span className="label-micro px-2 py-0.5 rounded border" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>observed estimate</span>
        </div>
        <div className="num text-4xl font-bold" style={{ color: 'var(--cyan)' }}>
          {fmtEff(learned.efficiency)} <span className="text-base font-medium" style={{ color: 'var(--muted)' }}>km/L</span>
        </div>
        <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
          {learned.source === 'full-tank cycles' && `Weighted toward your recent full-tank cycles (${learned.reliableCount} reliable).`}
          {learned.source === 'all cycles' && 'From partial refill data — record full-tank refills for higher reliability.'}
          {learned.source === 'provisional' && 'Provisional figure you set. It is replaced once a real fuel cycle completes.'}
          {learned.source === 'none' && 'Nothing learned yet. Record two refills with riding in between to complete your first fuel cycle.'}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Stat label="This cycle" value={fmtEff(cycleNow)} unit="km/L" sub="live" />
          <Stat label="Recent (last 3)" value={fmtEff(learned.recent)} unit="km/L" />
          <Stat label="Best observed" value={fmtEff(learned.best)} unit="km/L" accent="var(--mint)" />
          <Stat label="Lowest observed" value={fmtEff(learned.worst)} unit="km/L" accent="var(--amber)" />
          <Stat label="Cycles done" value={String(learned.cycleCount)} />
          <Stat label="Reliable" value={String(learned.reliableCount)} sub="full → full" />
        </div>
        {behavior && (
          <div className="panel-2 p-3 mt-3">
            <div className="label-micro mb-1">Riding behavior (supporting info)</div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Across {behavior.sampleRides} rides: {behavior.hardEvents} hard accel/brake events, {Math.round(behavior.stopRatio * 100)}% stopped time — pattern looks{' '}
              <span className="font-semibold" style={{ color: behavior.label === 'smooth' ? 'var(--mint)' : behavior.label === 'mixed' ? 'var(--amber)' : 'var(--red)' }}>
                {behavior.label}
              </span>
              . Behavior helps explain mileage variation; it is not used as a fuel-consumption formula.
            </p>
          </div>
        )}
      </section>

      {/* Refill history */}
      <div className="label-micro pt-1">Refill history</div>
      {refills.length === 0 && (
        <div className="panel p-6 text-center" style={{ borderStyle: 'dashed' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No refills yet. Record your first fuel to begin.</p>
        </div>
      )}
      <div className="space-y-2">
        {refills.map((r) => (
          <div key={r.id} className="panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="num text-xl font-semibold">{fmtL(r.liters, 2)} L</span>
                {r.fullTank && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border align-middle" style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }}>FULL</span>
                )}
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{fmtDateTime(r.ts)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs num" style={{ color: 'var(--muted)' }}>
              {r.cycleDistanceKm != null && <span>cycle: {fmtKm(r.cycleDistanceKm, 1)} km</span>}
              {r.cycleEfficiency != null && (
                <span style={{ color: r.reliable ? 'var(--mint)' : 'var(--amber)' }}>
                  {r.cycleEfficiency.toFixed(1)} km/L {r.reliable ? '· reliable' : '· partial tank'}
                </span>
              )}
              {r.cycleDistanceKm == null && <span>baseline refill</span>}
              {r.totalCost != null && <span>{cur}{r.totalCost.toFixed(2)}</span>}
              {r.pricePerLiter != null && <span>{cur}{r.pricePerLiter.toFixed(2)}/L</span>}
            </div>
            {r.note && <p className="mt-1 text-xs italic" style={{ color: 'var(--muted)' }}>{r.note}</p>}
            <button
              onClick={() => {
                if (confirm('Delete this refill? Cycle calculations will be rebuilt.')) dispatch({ type: 'DELETE_REFILL', id: r.id })
              }}
              className="mt-2 text-[11px] underline min-h-[44px] inline-flex items-center"
              style={{ color: 'var(--red)' }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <RefillSheet open={refillOpen} onClose={() => setRefillOpen(false)} />
    </div>
  )
}
