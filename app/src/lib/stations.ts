// Nearby petrol stations via OpenStreetMap's Overpass API — no API key required.
// Structured so a Google Places/Maps integration can replace this later via config.

import { haversineKm, bearingDeg, bearingToCompass } from './geo'

export interface Station {
  id: string
  name: string
  lat: number
  lng: number
  distanceKm: number
  direction: string
  openingHours?: string
  brand?: string
}

export interface StationResult {
  stations: Station[]
  error: string | null
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export async function findNearbyStations(lat: number, lng: number, radiusM = 8000): Promise<StationResult> {
  const query = `
[out:json][timeout:20];
(
  node["amenity"="fuel"](around:${radiusM},${lat},${lng});
  way["amenity"="fuel"](around:${radiusM},${lat},${lng});
);
out center tags 40;`
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (!res.ok) throw new Error(`Overpass responded ${res.status}`)
    const json = await res.json()
    const stations: Station[] = (json.elements ?? [])
      .map((el: any) => {
        const slat = el.lat ?? el.center?.lat
        const slng = el.lon ?? el.center?.lon
        if (slat == null || slng == null) return null
        const d = haversineKm(lat, lng, slat, slng)
        return {
          id: `${el.type}/${el.id}`,
          name: el.tags?.name || el.tags?.brand || 'Fuel station',
          brand: el.tags?.brand,
          lat: slat,
          lng: slng,
          distanceKm: d,
          direction: bearingToCompass(bearingDeg(lat, lng, slat, slng)),
          openingHours: el.tags?.opening_hours,
        } as Station
      })
      .filter(Boolean)
      .sort((a: Station, b: Station) => a.distanceKm - b.distanceKm)
      .slice(0, 25)
    return { stations, error: null }
  } catch (e: any) {
    return { stations: [], error: e?.message ?? 'Could not reach the station database.' }
  }
}

/** Current position as a one-shot promise. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    })
  })
}
