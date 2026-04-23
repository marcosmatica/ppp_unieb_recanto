// src/hooks/useServiceWorker.js
import { useEffect } from 'react'

export function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister())
      }).catch(() => {})
      return
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {})
    })
  }, [])
}