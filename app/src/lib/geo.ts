// Geospatial helpers: haversine distance, bearing, GPS sanity filtering

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export interface FixDecision {
  accept: boolean
  segmentKm: number
  impliedSpeedKmh: number | null
}

/**
 * Decide whether a new GPS fix should extend the tracked distance.
 * Rejects poor-accuracy fixes, teleports, and physically impossible jumps.
 */
export function evaluateFix(
  prevLat: number | null,
  prevLng: number | null,
  prevTs: number | null,
  lat: number,
  lng: number,
  accuracyM: number | null,
  ts: number
): FixDecision {
  if (accuracyM != null && accuracyM > 65) {
    return { accept: false, segmentKm: 0, impliedSpeedKmh: null }
  }
  if (prevLat == null || prevLng == null || prevTs == null) {
    return { accept: true, segmentKm: 0, impliedSpeedKmh: null }
  }
  const segmentKm = haversineKm(prevLat, prevLng, lat, lng)
  const dtSec = (ts - prevTs) / 1000
  if (dtSec <= 0) return { accept: false, segmentKm: 0, impliedSpeedKmh: null }

  const impliedSpeedKmh = (segmentKm / dtSec) * 3600

  // GPS jitter while standing still: ignore micro-movements inside accuracy radius
  const jitterM = Math.max(accuracyM ?? 15, 12)
  if (segmentKm * 1000 < jitterM) {
    return { accept: false, segmentKm: 0, impliedSpeedKmh: 0 }
  }
  // Impossible jump: > 220 km/h implied => GPS glitch, drop the fix entirely
  if (impliedSpeedKmh > 220) {
    return { accept: false, segmentKm: 0, impliedSpeedKmh: null }
  }
  return { accept: true, segmentKm, impliedSpeedKmh }
}
