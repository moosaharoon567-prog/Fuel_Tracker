import { useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import Dashboard from './pages/Dashboard'
import Rides from './pages/Rides'
import Fuel from './pages/Fuel'
import Stations from './pages/Stations'
import Settings from './pages/Settings'

type Tab = 'dash' | 'rides' | 'fuel' | 'stations' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dash', label: 'Ride', icon: '◉' },
  { key: 'rides', label: 'History', icon: '≣' },
  { key: 'fuel', label: 'Fuel', icon: '⛽' },
  { key: 'stations', label: 'Stations', icon: '⌖' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
]

function Shell() {
  const [tab, setTab] = useState<Tab>('dash')
  const { state } = useStore()

  return (
    <div className="mx-auto max-w-lg min-h-[100dvh] flex flex-col">
      <header className="safe-top px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <div className="label-micro" style={{ fontSize: 9 }}>Bike Fuel Tracker</div>
          <div className="text-sm font-semibold mt-0.5">{state.settings.bikeName}</div>
        </div>
        {state.activeRide && (
          <span className="flex items-center gap-1.5 label-micro px-2 py-1 rounded-full border" style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }}>
            <span className="dot dot-live" /> riding
          </span>
        )}
      </header>

      <main className="flex-1 px-4 pt-1 pb-24">
        {tab === 'dash' && <Dashboard />}
        {tab === 'rides' && <Rides />}
        {tab === 'fuel' && <Fuel />}
        {tab === 'stations' && <Stations />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 safe-bottom"
        style={{ background: 'color-mix(in srgb, var(--panel) 92%, transparent)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)' }}
      >
        <div className="mx-auto max-w-lg grid grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex flex-col items-center gap-0.5 py-2 min-h-[56px]"
              style={{ color: tab === t.key ? 'var(--cyan)' : 'var(--muted)' }}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
