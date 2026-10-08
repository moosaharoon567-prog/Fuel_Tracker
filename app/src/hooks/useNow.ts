import { useEffect, useState } from 'react'

/** Re-renders every `ms` while `on` is true. */
export function useNow(ms = 1000, on = true): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms, on])
  return now
}
