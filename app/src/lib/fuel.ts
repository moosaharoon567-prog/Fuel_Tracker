// Fuel-cycle math, mileage learning, and remaining-range estimation.
// No hardcoded mileage: efficiency is learned from the rider's own refills.

import type { Refill, Settings, FuelCycleSummary, Ride } from './types'

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** All completed fuel cycles, derived from refill history (oldest first). */
export function getCycles(refills: Refill[]): FuelCycleSummary[] {
  const sorted = [...refills].sort((a, b) => a.ts - b.ts)
  const cycles: FuelCycleSummary[] = []
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i]
    if (r.cycleDistanceKm != null && r.cycleDistanceKm > 0 && r.liters > 0) {
      cycles.push({
        id: r.id,
        closedAt: r.ts,
        distanceKm: r.cycleDistanceKm,
        liters: r.liters,
        efficiency: r.cycleDistanceKm / r.liters,
        reliable: r.reliable,
      })
    }
  }
  return cycles
}

export interface LearnedMileage {
  /** Best available learned efficiency (km/L), or null if nothing known */
  efficiency: number | null
  source: 'full-tank cycles' | 'all cycles' | 'provisional' | 'none'
  average: number | null
  recent: number | null // weighted toward last 3 cycles
  best: number | null
  worst: number | null
  cycleCount: number
  reliableCount: number
}

export function learnMileage(refills: Refill[], settings: Settings): LearnedMileage {
  const cycles = getCycles(refills)
  const reliable = cycles.filter((c) => c.reliable)
  const pool = reliable.length > 0 ? reliable : cycles

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null)

  // Recency-weighted average over the pool (newest cycles weigh more)
  let efficiency: number | null = null
  if (pool.length > 0) {
    let wSum = 0
    let vSum = 0
    pool.forEach((c, i) => {
      const w = i + 1 // oldest weight 1 … newest weight n
      wSum += w
      vSum += c.efficiency * w
    })
    efficiency = vSum / wSum
  }

  const recentSlice = pool.slice(-3)
  const effs = pool.map((c) => c.efficiency)

  let source: LearnedMileage['source'] = 'none'
  if (reliable.length > 0) source = 'full-tank cycles'
  else if (cycles.length > 0) source = 'all cycles'
  else if (settings.provisionalEfficiency && settings.provisionalEfficiency > 0) source = 'provisional'

  if (efficiency == null && source === 'provisional') {
    efficiency = settings.provisionalEfficiency
  }

  return {
    efficiency,
    source,
    average: avg(effs),
    recent: avg(recentSlice.map((c) => c.efficiency)),
    best: effs.length ? Math.max(...effs) : null,
    worst: effs.length ? Math.min(...effs) : null,
    cycleCount: cycles.length,
    reliableCount: reliable.length,
  }
}

/** Distance ridden since the most recent refill. */
export function distanceSinceLastRefill(odometerKm: number, refills: Refill[]): number {
  if (refills.length === 0) return odometerKm
  const last = [...refills].sort((a, b) => b.ts - a.ts)[0]
  return Math.max(0, odometerKm - last.odometerKm)
}

/** Live efficiency of the currently open fuel cycle (distance so far / last refill liters). */
export function currentCycleEfficiency(odometerKm: number, refills: Refill[]): number | null {
  if (refills.length === 0) return null
  const last = [...refills].sort((a, b) => b.ts - a.ts)[0]
  const dist = Math.max(0, odometerKm - last.odometerKm)
  if (dist < 1 || last.liters <= 0) return null
  return dist / last.liters
}

export interface RangeEstimate {
  estFuelLiters: number | null
  theoreticalRangeKm: number | null
  usableRangeKm: number | null // after conservative margin and safety reserve
  low: boolean
  basis: string
}

export function estimateRange(odometerKm: number, refills: Refill[], settings: Settings): RangeEstimate {
  const learned = learnMileage(refills, settings)
  const eff = learned.efficiency
  if (refills.length === 0 || eff == null || eff <= 0) {
    return {
      estFuelLiters: null,
      theoreticalRangeKm: null,
      usableRangeKm: null,
      low: false,
      basis:
        refills.length === 0
          ? 'Record your first refill to start estimating.'
          : 'Range estimate unlocks after your first completed fuel cycle (or set a provisional figure in Settings).',
    }
  }

  const last = [...refills].sort((a, b) => b.ts - a.ts)[0]
  // Estimated fuel right after last refill, minus what riding since then consumed.
  const prevRemaining = last.estFuelAfter != null ? Math.max(0, last.estFuelAfter - last.liters) : 0
  const afterRefill =
    last.estFuelAfter != null ? last.estFuelAfter : Math.min(last.liters + prevRemaining, settings.tankCapacityLiters ?? Infinity)
  const sinceKm = Math.max(0, odometerKm - last.odometerKm)
  const consumed = sinceKm / eff
  let estFuel = afterRefill - consumed
  if (settings.tankCapacityLiters != null) estFuel = Math.min(estFuel, settings.tankCapacityLiters)
  estFuel = Math.max(0, estFuel)

  const theoretical = estFuel * eff
  const usable = Math.max(0, theoretical * (1 - settings.conservativeMargin) - settings.reserveKm)

  return {
    estFuelLiters: estFuel,
    theoreticalRangeKm: theoretical,
    usableRangeKm: usable,
    low: usable <= settings.lowFuelWarnKm,
    basis:
      learned.source === 'provisional'
        ? 'Based on your provisional figure — completes after the first fuel cycle.'
        : `Learned from ${learned.source === 'full-tank cycles' ? `${learned.reliableCount} full-tank cycle${learned.reliableCount === 1 ? '' : 's'}` : `${learned.cycleCount} fuel cycle${learned.cycleCount === 1 ? '' : 's'}`}.`,
  }
}

/**
 * Build the refill record for a new refill: closes the previous cycle.
 */
export function makeRefill(
  prev: Refill[],
  odometerKm: number,
  input: { ts: number; liters: number; fullTank: boolean; pricePerLiter?: number; totalCost?: number; note?: string },
  settings: Settings
): Refill {
  const sorted = [...prev].sort((a, b) => a.ts - b.ts)
  const last = sorted.length ? sorted[sorted.length - 1] : null

  let cycleDistanceKm: number | null = null
  let cycleEfficiency: number | null = null
  let reliable = false

  if (last) {
    cycleDistanceKm = Math.max(0, odometerKm - last.odometerKm)
    if (cycleDistanceKm > 0 && input.liters > 0) {
      cycleEfficiency = cycleDistanceKm / input.liters
      reliable = input.fullTank && last.fullTank
    }
  }

  // Estimated fuel after this refill
  let estFuelAfter: number | null = null
  const learned = learnMileage(prev, settings)
  const eff = learned.efficiency
  if (last && eff && eff > 0) {
    const prevEst = last.estFuelAfter ?? last.liters
    const remaining = Math.max(0, prevEst - (cycleDistanceKm ?? 0) / eff)
    estFuelAfter = remaining + input.liters
  } else {
    estFuelAfter = input.liters
  }
  if (settings.tankCapacityLiters != null) estFuelAfter = Math.min(estFuelAfter, settings.tankCapacityLiters)

  return {
    id: uid(),
    ts: input.ts,
    liters: input.liters,
    fullTank: input.fullTank,
    pricePerLiter: input.pricePerLiter,
    totalCost: input.totalCost,
    note: input.note,
    odometerKm,
    cycleDistanceKm,
    cycleEfficiency,
    reliable,
    estFuelAfter,
  }
}

/** Simple behavior summary from ride telemetry — supporting info only, never a fuel formula. */
export function behaviorSummary(rides: Ride[]): {
  hardEvents: number
  stopRatio: number
  label: 'smooth' | 'mixed' | 'aggressive'
  sampleRides: number
} | null {
  if (rides.length < 3) return null
  const totalHard = rides.reduce((s, r) => s + r.hardAccelCount + r.hardBrakeCount, 0)
  const totalDist = rides.reduce((s, r) => s + r.distanceKm, 0)
  const totalStopped = rides.reduce((s, r) => s + r.stopRatio * r.durationSec, 0)
  const totalTime = rides.reduce((s, r) => s + r.durationSec, 0)
  const per100 = totalDist > 0 ? (totalHard / totalDist) * 100 : 0
  const stopRatio = totalTime > 0 ? totalStopped / totalTime : 0
  const label = per100 > 25 || stopRatio > 0.45 ? 'aggressive' : per100 > 10 || stopRatio > 0.25 ? 'mixed' : 'smooth'
  return { hardEvents: totalHard, stopRatio, label, sampleRides: rides.length }
}
