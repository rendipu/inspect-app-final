import { useState, useEffect } from 'react'

export function useOnline() {
  // Gunakan lazy initializer agar navigator hanya diakses di browser,
  // tidak saat SSR atau build time
  const [online, setOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    // Double-check saat mount karena state awal mungkin stale
    setOnline(navigator.onLine)

    const handleOnline  = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}