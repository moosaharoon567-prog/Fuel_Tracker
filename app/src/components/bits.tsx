import type { ReactNode } from 'react'

export function Stat({ label, value, unit, accent, sub }: { label: string; value: string; unit?: string; accent?: string; sub?: string }) {
  return (
    <div className="panel-2 p-3 min-w-0">
      <div className="label-micro truncate">{label}</div>
      <div className="num mt-1 text-xl font-semibold leading-none" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11px] truncate" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto panel p-5 sm:mb-0"
        style={{ borderRadius: '18px 18px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="label-micro" style={{ fontSize: 12, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 grid place-items-center text-xl" style={{ color: 'var(--muted)' }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function RouteMap({ points, height = 120 }: { points: [number, number][]; height?: number }) {
  if (!points || points.length < 2) {
    return (
      <div className="panel-2 grid place-items-center text-xs" style={{ height, color: 'var(--muted)' }}>
        No route recorded
      </div>
    )
  }
  const lats = points.map((p) => p[0])
  const lngs = points.map((p) => p[1])
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const pad = 8
  const w = 320, h = height
  const spanLat = Math.max(maxLat - minLat, 1e-6)
  const spanLng = Math.max(maxLng - minLng, 1e-6)
  const scale = Math.min((w - pad * 2) / spanLng, (h - pad * 2) / spanLat)
  const offX = (w - spanLng * scale) / 2
  const offY = (h - spanLat * scale) / 2
  const path = points
    .map(([lat, lng], i) => `${i === 0 ? 'M' : 'L'}${(offX + (lng - minLng) * scale).toFixed(1)},${(h - offY - (lat - minLat) * scale).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full panel-2" style={{ height }} role="img" aria-label="Ride route">
      <path d={path} fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={offX + (points[0][1] - minLng) * scale} cy={h - offY - (points[0][0] - minLat) * scale} r="4" fill="var(--mint)" />
      <circle
        cx={offX + (points[points.length - 1][1] - minLng) * scale}
        cy={h - offY - (points[points.length - 1][0] - minLat) * scale}
        r="4"
        fill="var(--red)"
      />
    </svg>
  )
}
