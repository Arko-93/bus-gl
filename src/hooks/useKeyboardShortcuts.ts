// src/hooks/useKeyboardShortcuts.ts
// Keyboard navigation for route filtering and popup closing

import { useEffect } from 'react'
import { useAppStore } from '../state/appStore'
import { KNOWN_ROUTES } from '../data/ridangoRealtime'

/**
 * Route key mappings:
 * - 1: Route 1
 * - 2: Route 2
 * - 3: Route 3
 * - 4 or x: Route X2
 * - 0 or a: Toggle all routes
 * - Escape: Close popup/bottom sheet
 */
export function useKeyboardShortcuts() {
  const toggleRoute = useAppStore((state) => state.toggleRoute)
  const setAllRoutes = useAppStore((state) => state.setAllRoutes)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)
  const enabledRoutes = useAppStore((state) => state.enabledRoutes)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      // Don't interfere with browser shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return
      }

      switch (e.key) {
        case '1':
          toggleRoute('1')
          break
        case '2':
          toggleRoute('2')
          break
        case '3':
          toggleRoute('3')
          break
        case '4':
        case 'x':
        case 'X':
          toggleRoute('X2')
          break
        case '0':
        case 'a':
        case 'A': {
          // Toggle all: if all are enabled, show only first; otherwise enable all
          const allEnabled = KNOWN_ROUTES.every((r) => enabledRoutes.has(r))
          setAllRoutes(!allEnabled)
          break
        }
        case 'Escape':
          setSelectedVehicleId(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleRoute, setAllRoutes, setSelectedVehicleId, enabledRoutes])
}
