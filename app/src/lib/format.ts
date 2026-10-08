export function fmtKm(v: number | null | undefined, digits = 0): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function fmtL(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toFixed(digits)
}

export function fmtEff(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toFixed(1)
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function fmtDateTime(ts: number): string {
  return `${fmtDate(ts)}, ${fmtTime(ts)}`
}
