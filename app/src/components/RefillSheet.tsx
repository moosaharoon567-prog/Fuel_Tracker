import { useState } from 'react'
import { Sheet } from './bits'
import { useStore } from '../lib/store'
import type { Refill } from '../lib/types'

function toLocalInputValue(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function RefillSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addRefill } = useStore()
  const [liters, setLiters] = useState('')
  const [when, setWhen] = useState(toLocalInputValue(Date.now()))
  const [price, setPrice] = useState('')
  const [total, setTotal] = useState('')
  const [fullTank, setFullTank] = useState(true)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Refill | null>(null)

  const isFirst = state.refills.length === 0

  const reset = () => {
    setLiters('')
    setPrice('')
    setTotal('')
    setNote('')
    setFullTank(true)
    setWhen(toLocalInputValue(Date.now()))
    setError('')
    setSaved(null)
  }

  const submit = () => {
    const l = parseFloat(liters)
    if (!isFinite(l) || l <= 0) {
      setError('Enter the liters you added.')
      return
    }
    const ts = new Date(when).getTime()
    const refill = addRefill({
      ts: isFinite(ts) ? ts : Date.now(),
      liters: l,
      fullTank,
      pricePerLiter: price ? parseFloat(price) : undefined,
      totalCost: total ? parseFloat(total) : undefined,
      note: note.trim() || undefined,
    })
    setSaved(refill)
    setError('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const inputCls =
    'w-full panel-2 px-3 py-3 text-base num outline-none focus:ring-2'
    + ' [color-scheme:dark]'
  const inputStyle = { color: 'var(--text)', '--tw-ring-color': 'var(--cyan)' } as React.CSSProperties

  return (
    <Sheet open={open} onClose={close} title={isFirst ? 'Record initial fuel' : 'Record refill'}>
      {saved ? (
        <div className="space-y-4">
          <div className="panel-2 p-4 space-y-2">
            <div className="label-micro">Refill saved</div>
            <div className="num text-2xl font-semibold" style={{ color: 'var(--mint)' }}>
              {saved.liters.toFixed(2)} L
            </div>
            {saved.cycleEfficiency != null ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                Fuel cycle closed: <span className="num" style={{ color: 'var(--text)' }}>{saved.cycleDistanceKm!.toFixed(1)} km</span> on{' '}
                <span className="num" style={{ color: 'var(--text)' }}>{saved.liters.toFixed(2)} L</span> → observed{' '}
                <span className="num font-semibold" style={{ color: 'var(--cyan)' }}>{saved.cycleEfficiency.toFixed(1)} km/L</span>
                {saved.reliable ? ' (full-to-full · reliable)' : ' (not full-to-full · less reliable)'}
              </div>
            ) : (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {state.refills.length <= 1
                  ? 'Baseline recorded. Ride, then record your next refill to complete the first fuel cycle.'
                  : 'Cycle too short to compute mileage yet.'}
              </div>
            )}
          </div>
          <button onClick={close} className="w-full py-4 rounded-xl font-semibold text-base" style={{ background: 'var(--cyan)', color: '#050810' }}>
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label-micro block mb-1.5">Liters added *</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              placeholder="e.g. 5.0"
              className={inputCls}
              style={inputStyle}
              autoFocus
            />
          </div>
          <div>
            <label className="label-micro block mb-1.5">Date & time</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="label-micro block mb-1.5">Full tank refill?</label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setFullTank(v)}
                  className="py-3.5 rounded-xl font-semibold text-base border"
                  style={
                    fullTank === v
                      ? { background: 'var(--glow-cyan)', borderColor: 'var(--cyan)', color: 'var(--cyan)' }
                      : { background: 'var(--panel-2)', borderColor: 'var(--line)', color: 'var(--muted)' }
                  }
                >
                  {v ? 'Yes, full' : 'No, partial'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              Only full-tank → full-tank cycles count as highly reliable mileage.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-micro block mb-1.5">Price / L (opt.)</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="label-micro block mb-1.5">Total cost (opt.)</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="label-micro block mb-1.5">Note (opt.)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. highway trip" className={inputCls} style={inputStyle} maxLength={80} />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          <button onClick={submit} className="w-full py-4 rounded-xl font-semibold text-base" style={{ background: 'var(--cyan)', color: '#050810' }}>
            Save refill
          </button>
        </div>
      )}
    </Sheet>
  )
}
