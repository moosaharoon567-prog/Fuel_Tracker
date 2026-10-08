import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { STATE_KEY, DEFAULT_SETTINGS, type AppState, type Ride, type Refill, type Settings, type ActiveRide } from './types'
import { makeRefill, uid } from './fuel'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      return {
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        activeRide: parsed.activeRide ?? null,
      }
    }
  } catch {
    /* corrupted state -> start fresh */
  }
  return {
    version: 1,
    odometerKm: 0,
    rides: [],
    refills: [],
    settings: { ...DEFAULT_SETTINGS },
    activeRide: null,
  }
}

export type Action =
  | { type: 'START_RIDE'; ride: ActiveRide }
  | { type: 'UPDATE_RIDE'; ride: ActiveRide }
  | { type: 'STOP_RIDE'; ride: Ride }
  | { type: 'DISCARD_RIDE' }
  | { type: 'ADD_REFILL'; refill: Refill }
  | { type: 'DELETE_REFILL'; id: string }
  | { type: 'DELETE_RIDE'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'IMPORT_STATE'; state: AppState }
  | { type: 'RESET_ALL' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'START_RIDE':
      return { ...state, activeRide: action.ride }
    case 'UPDATE_RIDE':
      return { ...state, activeRide: action.ride }
    case 'STOP_RIDE':
      return {
        ...state,
        activeRide: null,
        rides: [...state.rides, action.ride],
        odometerKm: state.odometerKm + action.ride.distanceKm,
      }
    case 'DISCARD_RIDE':
      return { ...state, activeRide: null }
    case 'ADD_REFILL':
      return { ...state, refills: [...state.refills, action.refill] }
    case 'DELETE_REFILL': {
      const refills = state.refills.filter((r) => r.id !== action.id).sort((a, b) => a.ts - b.ts)
      // Rebuild derived cycle fields after deletion
      const rebuilt: Refill[] = []
      for (const r of refills) {
        rebuilt.push(
          makeRefill(rebuilt, r.odometerKm, {
            ts: r.ts,
            liters: r.liters,
            fullTank: r.fullTank,
            pricePerLiter: r.pricePerLiter,
            totalCost: r.totalCost,
            note: r.note,
          }, state.settings)
        )
      }
      return { ...state, refills: rebuilt }
    }
    case 'DELETE_RIDE': {
      const ride = state.rides.find((r) => r.id === action.id)
      if (!ride) return state
      return {
        ...state,
        rides: state.rides.filter((r) => r.id !== action.id),
        odometerKm: Math.max(0, state.odometerKm - ride.distanceKm),
      }
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'IMPORT_STATE':
      return action.state
    case 'RESET_ALL':
      return { version: 1, odometerKm: 0, rides: [], refills: [], settings: { ...DEFAULT_SETTINGS }, activeRide: null }
  }
}

interface Store {
  state: AppState
  dispatch: React.Dispatch<Action>
  addRefill: (input: { ts: number; liters: number; fullTank: boolean; pricePerLiter?: number; totalCost?: number; note?: string }) => Refill
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state))
    } catch {
      /* storage full / private mode */
    }
  }, [state])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', state.settings.theme === 'light')
  }, [state.settings.theme])

  const store = useMemo<Store>(
    () => ({
      state,
      dispatch,
      addRefill: (input) => {
        const refill = makeRefill(state.refills, state.odometerKm, input, state.settings)
        dispatch({ type: 'ADD_REFILL', refill })
        return refill
      },
    }),
    [state]
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}

export function newActiveRide(): ActiveRide {
  return {
    startTs: Date.now(),
    distanceKm: 0,
    lastLat: null,
    lastLng: null,
    lastFixTs: null,
    currentSpeedKmh: null,
    maxSpeedKmh: 0,
    speedSamples: [],
    hardAccelCount: 0,
    hardBrakeCount: 0,
    movingMs: 0,
    stoppedMs: 0,
    points: [],
    permissionDenied: false,
    gpsActive: false,
  }
}

export function finalizeRide(r: ActiveRide): Ride {
  const endTs = Date.now()
  const durationSec = Math.max(1, Math.round((endTs - r.startTs) / 1000))
  const totalMs = r.movingMs + r.stoppedMs
  return {
    id: uid(),
    startTs: r.startTs,
    endTs,
    distanceKm: r.distanceKm,
    durationSec,
    avgSpeedKmh: r.distanceKm / (durationSec / 3600),
    maxSpeedKmh: r.maxSpeedKmh,
    hardAccelCount: r.hardAccelCount,
    hardBrakeCount: r.hardBrakeCount,
    stopRatio: totalMs > 0 ? r.stoppedMs / totalMs : 0,
    points: r.points,
  }
}
