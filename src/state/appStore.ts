// src/state/appStore.ts
// Zustand store for app-wide UI state with localStorage persistence

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { KNOWN_ROUTES } from '../data/ridangoRealtime'
import { detectBrowserLocale, type Locale } from '../i18n/translations'
import type { Theme } from '../hooks/useResolvedTheme'

const STORAGE_KEY = 'nuuk-bus-preferences'

interface AppState {
  // Selected vehicle for details view
  selectedVehicleId: string | null
  setSelectedVehicleId: (id: string | null) => void

  // Route filter (which routes to show)
  enabledRoutes: Set<string>
  toggleRoute: (route: string) => void
  setAllRoutes: (enabled: boolean) => void

  // Mobile detection
  isMobile: boolean
  setIsMobile: (isMobile: boolean) => void

  // Feed error state
  feedError: string | null
  setFeedError: (error: string | null) => void

  // Last successful data fetch
  lastSuccessTime: number | null
  setLastSuccessTime: (time: number) => void

  // Bottom sheet open state (mobile)
  isBottomSheetOpen: boolean
  setBottomSheetOpen: (open: boolean) => void

  // Locale / language
  locale: Locale
  setLocale: (locale: Locale) => void

  // Theme (light, dark, or system)
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Selected vehicle
      selectedVehicleId: null,
      setSelectedVehicleId: (id) => set({ 
        selectedVehicleId: id,
        isBottomSheetOpen: id !== null,
      }),

      // Route filter - all routes enabled by default
      enabledRoutes: new Set(KNOWN_ROUTES),
      toggleRoute: (route) =>
        set((state) => {
          const allEnabled = state.enabledRoutes.size === KNOWN_ROUTES.length
          
          // If all routes are currently shown, clicking one filters to just that route
          if (allEnabled) {
            return { enabledRoutes: new Set([route]) }
          }
          
          // Otherwise, toggle the route on/off
          const newRoutes = new Set(state.enabledRoutes)
          if (newRoutes.has(route)) {
            // Don't allow removing the last route
            if (newRoutes.size > 1) {
              newRoutes.delete(route)
            }
          } else {
            // Add route to selection
            newRoutes.add(route)
          }
          return { enabledRoutes: newRoutes }
        }),
      setAllRoutes: (enabled) =>
        set({
          enabledRoutes: enabled ? new Set(KNOWN_ROUTES) : new Set([KNOWN_ROUTES[0]]),
        }),

      // Mobile detection
      isMobile: false,
      setIsMobile: (isMobile) => set({ isMobile }),

      // Feed error
      feedError: null,
      setFeedError: (error) => set({ feedError: error }),

      // Last success time
      lastSuccessTime: null,
      setLastSuccessTime: (time) => set({ lastSuccessTime: time }),

      // Bottom sheet
      isBottomSheetOpen: false,
      setBottomSheetOpen: (open) => set({ isBottomSheetOpen: open }),

      // Locale - detect from browser or default to English
      locale: detectBrowserLocale(),
      setLocale: (locale) => set({ locale }),

      // Theme - default to system preference
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: STORAGE_KEY,
      // Persist route preferences, locale, and theme
      partialize: (state) => ({ 
        enabledRoutes: state.enabledRoutes,
        locale: state.locale,
        theme: state.theme,
      }),
      // Custom serialization for Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          try {
            const parsed = JSON.parse(str)
            if (parsed.state?.enabledRoutes) {
              parsed.state.enabledRoutes = new Set(parsed.state.enabledRoutes)
            }
            return parsed
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              enabledRoutes: value.state?.enabledRoutes 
                ? Array.from(value.state.enabledRoutes) 
                : [],
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)

/**
 * Selector for filtered vehicles based on enabled routes
 */
export function filterVehiclesByRoute<T extends { route: string }>(
  vehicles: T[],
  enabledRoutes: Set<string>
): T[] {
  return vehicles.filter((v) => enabledRoutes.has(v.route))
}
