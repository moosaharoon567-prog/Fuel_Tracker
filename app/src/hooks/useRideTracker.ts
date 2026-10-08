import { useEffect, useRef } from 'react'
import { useStore, newActiveRide } from '../lib/store'
import { evaluateFix } from '../lib/geo'
import type { ActiveRide } from '../lib/types'

const HARD_ACCEL_KMH_PER_S = 2.5 // ~9 km/h per second
const MAX_SAMPLES = 600

/**
 * GPS ride tracking via the W3C Geolocation API (the only option in a PWA).
 * Filters bad fixes and derives simple behavior telemetry from speed deltas.
 */
export function useRideTracker() {
  const { state, dispatch } = useStore()
  const watchId = useRef<number | null>(null)
  const lastSpeedRef = useRef<{ speed: number; ts: number } | null>(null)
  const activeRef = useRef<ActiveRide | null>(state.activeRide)
  activeRef.current = state.activeRide

  const startRide = () => {
    if (state.activeRide) return
    if (!('geolocation' in navigator)) {
      dispatch({ type: 'START_RIDE', ride: { ...newActiveRide(), permissionDenied: true } })
      return
    }
    lastSpeedRef.current = null
    dispatch({ type: 'START_RIDE', ride: newActiveRide() })
  }

  const riding = state.activeRide != null
  const rideStart = state.activeRide?.startTs

  // Attach/detach the geolocation watcher with the active ride
  useEffect(() => {
    if (!riding) return

    const onFix = (pos: GeolocationPosition) => {
      const prev = activeRef.current
      if (!prev) return
      const now = pos.timestamp || Date.now()
      const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords

      const verdict = evaluateFix(prev.lastLat, prev.lastLng, prev.lastFixTs, lat, lng, accuracy, now)

      let speedKmh: number | null = speed != null && speed >= 0 ? speed * 3.6 : verdict.impliedSpeedKmh
      if (speedKmh != null && speedKmh > 220) speedKmh = null

      const dtMs = prev.lastFixTs ? Math.min(Math.max(now - prev.lastFixTs, 0), 60_000) : 0
      const moving = (speedKmh ?? 0) > 3

      // Behavior telemetry from speed deltas (supporting info, not a fuel formula)
      let hardAccel = prev.hardAccelCount
      let hardBrake = prev.hardBrakeCount
      if (speedKmh != null && lastSpeedRef.current) {
        const dt = (now - lastSpeedRef.current.ts) / 1000
        if (dt > 0.5 && dt < 10) {
          const delta = (speedKmh - lastSpeedRef.current.speed) / dt
          if (delta > HARD_ACCEL_KMH_PER_S) hardAccel += 1
          else if (delta < -HARD_ACCEL_KMH_PER_S) hardBrake += 1
        }
      }
      if (speedKmh != null) lastSpeedRef.current = { speed: speedKmh, ts: now }

      const samples = [...prev.speedSamples]
      if (speedKmh != null) {
        samples.push(speedKmh)
        if (samples.length > MAX_SAMPLES) samples.shift()
      }

      const points = [...prev.points]
      if (verdict.accept) {
        if (points.length >= 800) {
          const decimated = points.filter((_, i) => i % 2 === 0)
          points.splice(0, points.length, ...decimated)
        }
        if (points.length === 0 || verdict.segmentKm > 0) points.push([lat, lng])
      }

      const next: ActiveRide = {
        ...prev,
        distanceKm: prev.distanceKm + verdict.segmentKm,
        lastLat: verdict.accept || prev.lastLat == null ? lat : prev.lastLat,
        lastLng: verdict.accept || prev.lastLng == null ? lng : prev.lastLng,
        lastFixTs: verdict.accept || prev.lastFixTs == null ? now : prev.lastFixTs,
        currentSpeedKmh: speedKmh,
        maxSpeedKmh: speedKmh != null ? Math.max(prev.maxSpeedKmh, speedKmh) : prev.maxSpeedKmh,
        speedSamples: samples,
        hardAccelCount: hardAccel,
        hardBrakeCount: hardBrake,
        movingMs: prev.movingMs + (moving ? dtMs : 0),
        stoppedMs: prev.stoppedMs + (moving ? 0 : dtMs),
        points,
        gpsActive: true,
        permissionDenied: false,
      }
      dispatch({ type: 'UPDATE_RIDE', ride: next })
    }

    const onError = (err: GeolocationPositionError) => {
      const prev = activeRef.current
      if (!prev) return
      dispatch({
        type: 'UPDATE_RIDE',
        ride: { ...prev, permissionDenied: err.code === err.PERMISSION_DENIED, gpsActive: false },
      })
    }

    watchId.current = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15_000,
    })

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
    }
  }, [riding, rideStart, dispatch])

  return { startRide }
}
