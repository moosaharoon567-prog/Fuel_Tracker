// Core data model for Bike Fuel Tracker

export interface Ride {
  id: string
  startTs: number
  endTs: number
  distanceKm: number
  durationSec: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  hardAccelCount: number
  hardBrakeCount: number
  stopRatio: number // 0..1 share of time spent nearly stopped while riding
  points: [number, number][] // decimated GPS route [lat, lng]
}

export interface Refill {
  id: string
  ts: number
  liters: number
  fullTank: boolean
  pricePerLiter?: number
  totalCost?: number
  note?: string
  /** App odometer (km) at the moment of this refill */
  odometerKm: number
  /** Distance ridden since previous refill (null for the first refill) */
  cycleDistanceKm: number | null
  /** Observed efficiency of the cycle this refill closes (km/L), if computable */
  cycleEfficiency: number | null
  /** True when both this refill and the previous one were full-tank */
  reliable: boolean
  /** Estimated fuel in tank right after this refill (L) */
  estFuelAfter: number | null
}

export interface FuelCycleSummary {
  id: string
  closedAt: number
  distanceKm: number
  liters: number
  efficiency: number
  reliable: boolean
}

export interface Settings {
  reserveKm: number // safety reserve subtracted from estimated range
  lowFuelWarnKm: number // warn when estimated range falls below this
  conservativeMargin: number // 0..0.5 extra margin applied to range estimate
  provisionalEfficiency: number | null // user-entered, used until first cycle completes
  tankCapacityLiters: number | null
  bikeName: string
  theme: 'dark' | 'light'
  currency: string
}

export interface ActiveRide {
  startTs: number
  distanceKm: number
  lastLat: number | null
  lastLng: number | null
  lastFixTs: number | null
  currentSpeedKmh: number | null
  maxSpeedKmh: number
  speedSamples: number[] // km/h samples while moving (capped)
  hardAccelCount: number
  hardBrakeCount: number
  movingMs: number
  stoppedMs: number
  points: [number, number][]
  permissionDenied: boolean
  gpsActive: boolean
}

export interface AppState {
  version: number
  odometerKm: number // cumulative app-tracked distance
  rides: Ride[]
  refills: Refill[]
  settings: Settings
  activeRide: ActiveRide | null
}

export const DEFAULT_SETTINGS: Settings = {
  reserveKm: 30,
  lowFuelWarnKm: 60,
  conservativeMargin: 0.1,
  provisionalEfficiency: null,
  tankCapacityLiters: null,
  bikeName: 'My Bike',
  theme: 'dark',
  currency: '₹',
}

export const STATE_KEY = 'bike-fuel-tracker-v1'
