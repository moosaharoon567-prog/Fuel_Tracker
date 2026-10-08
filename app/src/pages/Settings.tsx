import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import type { AppState } from '../lib/types'

export default function Settings() {
  const { state, dispatch } = useStore()
  const s = state.settings
  const fileRef = useRef<HTMLInputElement>(null)
  const [mapsKey, setMapsKey] = useState('')
  const [installEvt, setInstallEvt] = useState<any>(null)

  // Capture PWA install prompt
  if (typeof window !== 'undefined' && !(window as any).__bftInstallHooked) {
    ;(window as any).__bftInstallHooked = true
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      ;(window as any).__bftInstallEvt = e
    })
  }
  if (!installEvt && (window as any).__bftInstallEvt) setInstallEvt((window as any).__bftInstallEvt)

  const num = (v: string) => {
    const n = parseFloat(v)
    return isFinite(n) && n >= 0 ? n : null
  }

  const field = (
    label: string,
    value: string | number,
    onChange: (v: string) => void,
    opts?: { step?: string; suffix?: string; placeholder?: string; help?: string }
  ) => (
    <div>
      <label className="label-micro block mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={opts?.step ?? '1'}
          min="0"
          value={value}
          placeholder={opts?.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full panel-2 px-3 py-3 text-base num outline-none min-h-[48px]"
          style={{ color: 'var(--text)' }}
        />
        {opts?.suffix && <span className="text-sm shrink-0" style={{ color: 'var(--muted)' }}>{opts.suffix}</span>}
      </div>
      {opts?.help && <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>{opts.help}</p>}
    </div>
  )

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bike-fuel-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState
        if (!parsed || !Array.isArray(parsed.rides) || !Array.isArray(parsed.refills)) throw new Error('bad file')
        dispatch({ type: 'IMPORT_STATE', state: { ...parsed, activeRide: null } })
        alert('Data imported.')
      } catch {
        alert('That file is not a valid Bike Fuel Tracker export.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-3 pb-4">
      <h1 className="label-micro pt-1" style={{ fontSize: 13, color: 'var(--text)' }}>Settings</h1>

      <section className="panel p-4 space-y-4">
        <div className="label-micro">Bike</div>
        <div>
          <label className="label-micro block mb-1.5">Bike name</label>
          <input
            type="text"
            value={s.bikeName}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { bikeName: e.target.value } })}
            className="w-full panel-2 px-3 py-3 text-base outline-none min-h-[48px]"
            style={{ color: 'var(--text)' }}
            maxLength={40}
          />
        </div>
        {field('Tank capacity', s.tankCapacityLiters ?? '', (v) => dispatch({ type: 'UPDATE_SETTINGS', settings: { tankCapacityLiters: num(v) } }), {
          step: '0.1', suffix: 'L', placeholder: 'optional',
          help: 'Caps the estimated fuel so it never exceeds your tank.',
        })}
        {field('Provisional mileage', s.provisionalEfficiency ?? '', (v) => dispatch({ type: 'UPDATE_SETTINGS', settings: { provisionalEfficiency: num(v) } }), {
          step: '0.1', suffix: 'km/L', placeholder: 'optional',
          help: 'Used only until your first real fuel cycle completes. The app otherwise learns from your refills — nothing is hardcoded.',
        })}
      </section>

      <section className="panel p-4 space-y-4">
        <div className="label-micro">Safety</div>
        {field('Safety reserve', s.reserveKm, (v) => dispatch({ type: 'UPDATE_SETTINGS', settings: { reserveKm: num(v) ?? 0 } }), {
          suffix: 'km', help: 'Subtracted from the displayed range so you never plan on the last kilometer.',
        })}
        {field('Low-fuel warning below', s.lowFuelWarnKm, (v) => dispatch({ type: 'UPDATE_SETTINGS', settings: { lowFuelWarnKm: num(v) ?? 0 } }), { suffix: 'km' })}
        <div>
          <label className="label-micro block mb-1.5">Conservative margin — {Math.round(s.conservativeMargin * 100)}%</label>
          <input
            type="range"
            min={0}
            max={40}
            step={5}
            value={Math.round(s.conservativeMargin * 100)}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { conservativeMargin: Number(e.target.value) / 100 } })}
            className="w-full h-11 accent-cyan-400"
          />
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Extra margin on top of the reserve, for traffic, detours and riding style.</p>
        </div>
      </section>

      <section className="panel p-4 space-y-3">
        <div className="label-micro">Appearance & app</div>
        <div className="flex items-center justify-between min-h-[48px]">
          <span className="text-sm">Theme</span>
          <div className="grid grid-cols-2 gap-1 panel-2 p-1 rounded-xl">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { theme: t } })}
                className="px-4 py-2 rounded-lg text-sm font-medium capitalize min-h-[44px]"
                style={s.theme === t ? { background: 'var(--cyan)', color: '#050810' } : { color: 'var(--muted)' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between min-h-[48px]">
          <span className="text-sm">Install app</span>
          <button
            onClick={async () => {
              const evt = installEvt ?? (window as any).__bftInstallEvt
              if (evt) { evt.prompt(); await evt.userChoice; setInstallEvt(null); ;(window as any).__bftInstallEvt = null }
              else alert("Use your browser's menu → “Add to Home screen” to install.")
            }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px]"
            style={{ background: 'var(--panel-2)', color: 'var(--cyan)', border: '1px solid var(--line)' }}
          >
            Install
          </button>
        </div>
        <div>
          <label className="label-micro block mb-1.5">Google Maps API key (optional)</label>
          <input
            type="password"
            value={mapsKey}
            onChange={(e) => setMapsKey(e.target.value)}
            placeholder="Paste key to enable map view later"
            className="w-full panel-2 px-3 py-3 text-base outline-none min-h-[48px]"
            style={{ color: 'var(--text)' }}
          />
          <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            The map view is pre-wired for Google Maps. Keys belong in a backend config, not client code — this field is a placeholder for that integration and is not stored.
          </p>
        </div>
      </section>

      <section className="panel p-4 space-y-2">
        <div className="label-micro mb-1">Data</div>
        <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>
          All data is stored locally in this browser (this device only). Export regularly — clearing browser data erases it.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportData} className="py-3 rounded-xl text-sm font-medium border min-h-[48px]" style={{ borderColor: 'var(--line)', color: 'var(--cyan)' }}>
            Export data
          </button>
          <button onClick={() => fileRef.current?.click()} className="py-3 rounded-xl text-sm font-medium border min-h-[48px]" style={{ borderColor: 'var(--line)', color: 'var(--cyan)' }}>
            Import data
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        <button
          onClick={() => {
            if (confirm('Erase ALL rides, refills and settings? This cannot be undone.')) dispatch({ type: 'RESET_ALL' })
          }}
          className="w-full py-3 rounded-xl text-sm font-medium border min-h-[48px]"
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          Erase everything
        </button>
      </section>

      <p className="text-[11px] leading-relaxed px-1" style={{ color: 'var(--muted)' }}>
        All fuel and range figures are estimates derived from your own refill and GPS data. The app cannot measure the actual fuel in your tank.
      </p>
    </div>
  )
}
