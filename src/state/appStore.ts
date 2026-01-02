// src/state/appStore.ts
// Zustand store for app-wide UI state with localStorage persistence

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { KNOWN_ROUTES, type KnownRoute } from '../data/ridangoRealtime'
import { type Locale } from '../i18n/translations'
import type { Theme } from '../hooks/useResolvedTheme'

const STORAGE_KEY = 'nuuk-bus-preferences'

function getPersistedPreferences(): { locale?: Locale; theme?: Theme } {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const state = parsed?.state ?? {}
    const locale = ['kl', 'da', 'en'].includes(state.locale) ? (state.locale as Locale) : undefined
    const theme = ['light', 'dark', 'system'].includes(state.theme) ? (state.theme as Theme) : undefined
    return { locale, theme }
  } catch {
    return {}
  }
}

const persistedPreferences = getPersistedPreferences()

interface AppState {
  // Selected vehicle for details view
  selectedVehicleId: string | null
  setSelectedVehicleId: (id: string | null, options?: { openPanel?: boolean }) => void

  // Selected stop for details view
  selectedStopId: number | null
  setSelectedStopId: (id: number | null, options?: { openPanel?: boolean }) => void

  // Route filter (which routes to show)
  enabledRoutes: Set<KnownRoute>
  toggleRoute: (route: KnownRoute) => void
  setAllRoutes: (enabled: boolean) => void

  // Stop filter (which stops to show - empty means show all)
  filteredStopIds: Set<number>
  showAllStops: boolean
  addStopFilter: (stopId: number, stopName: string) => void
  removeStopFilter: (stopId: number) => void
  clearStopFilters: () => void
  setStopFilters: (stops: Array<{ id: number; name: string }>) => void
  setShowAllStops: (show: boolean) => void
  filteredStopNames: Map<number, string>
  selectedStopRoute: KnownRoute | null
  setSelectedStopRoute: (route: KnownRoute | null) => void
  selectedStopRouteTripEnabled: boolean
  setSelectedStopRouteTripEnabled: (enabled: boolean) => void
  selectedStopRouteFromId: number | null
  selectedStopRouteToId: number | null
  setSelectedStopRouteRange: (fromId: number | null, toId: number | null) => void

  // Mobile detection
  isMobile: boolean
  setIsMobile: (isMobile: boolean) => void
  isLandscapeMobile: boolean
  setIsLandscapeMobile: (isLandscape: boolean) => void

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
      setSelectedVehicleId: (id, options) =>
        set((state) => {
          const openPanel = options?.openPanel ?? state.isMobile
          return {
            selectedVehicleId: id,
            selectedStopId: null, // Clear stop selection when vehicle is selected
            isBottomSheetOpen: openPanel ? id !== null : false,
          }
        }),

      // Selected stop
      selectedStopId: null,
      setSelectedStopId: (id, options) =>
        set((state) => {
          const openPanel = options?.openPanel ?? state.isMobile
          return {
            selectedStopId: id,
            selectedVehicleId: null, // Clear vehicle selection when stop is selected
            isBottomSheetOpen: openPanel ? id !== null : false,
          }
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

      // Stop filter - empty means show all stops
      filteredStopIds: new Set<number>(),
      filteredStopNames: new Map<number, string>(),
      showAllStops: true,
      addStopFilter: (stopId, stopName) =>
        set((state) => {
          const newIds = new Set(state.filteredStopIds)
          const newNames = new Map(state.filteredStopNames)
          newIds.add(stopId)
          newNames.set(stopId, stopName)
          return { 
            filteredStopIds: newIds, 
            filteredStopNames: newNames,
            showAllStops: false 
          }
        }),
      removeStopFilter: (stopId) =>
        set((state) => {
          const newIds = new Set(state.filteredStopIds)
          const newNames = new Map(state.filteredStopNames)
          newIds.delete(stopId)
          newNames.delete(stopId)
          // If no filters left, show all stops
          return { 
            filteredStopIds: newIds, 
            filteredStopNames: newNames,
            showAllStops: newIds.size === 0 
          }
        }),
      clearStopFilters: () =>
        set({ 
          filteredStopIds: new Set<number>(), 
          filteredStopNames: new Map<number, string>(),
          showAllStops: true,
          selectedStopRoute: null,
          selectedStopRouteTripEnabled: false,
          selectedStopRouteFromId: null,
          selectedStopRouteToId: null,
        }),
      setStopFilters: (stops) =>
        set(() => {
          const newIds = new Set<number>()
          const newNames = new Map<number, string>()
          for (const stop of stops) {
            newIds.add(stop.id)
            newNames.set(stop.id, stop.name)
          }
          return {
            filteredStopIds: newIds,
            filteredStopNames: newNames,
            showAllStops: newIds.size === 0,
          }
        }),
      setShowAllStops: (show) =>
        set({ showAllStops: show }),
      selectedStopRoute: null,
      setSelectedStopRoute: (route) => set({ selectedStopRoute: route }),
      selectedStopRouteTripEnabled: false,
      setSelectedStopRouteTripEnabled: (enabled) => set({ selectedStopRouteTripEnabled: enabled }),
      selectedStopRouteFromId: null,
      selectedStopRouteToId: null,
      setSelectedStopRouteRange: (fromId, toId) =>
        set({ selectedStopRouteFromId: fromId, selectedStopRouteToId: toId }),

      // Mobile detection
      isMobile: false,
      setIsMobile: (isMobile) => set({ isMobile }),
      isLandscapeMobile: false,
      setIsLandscapeMobile: (isLandscape) => set({ isLandscapeMobile: isLandscape }),

      // Feed error
      feedError: null,
      setFeedError: (error) => set({ feedError: error }),

      // Last success time
      lastSuccessTime: null,
      setLastSuccessTime: (time) => set({ lastSuccessTime: time }),

      // Bottom sheet
      isBottomSheetOpen: false,
      setBottomSheetOpen: (open) => set({ isBottomSheetOpen: open }),

      // Locale - default to Kalaallisut unless user has explicitly chosen
      locale: persistedPreferences.locale ?? 'kl',
      setLocale: (locale) => set({ locale }),

      // Theme - default to system preference
      theme: persistedPreferences.theme ?? 'system',
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
  enabledRoutes: Set<KnownRoute>
): T[] {
  return vehicles.filter((v) => enabledRoutes.has(v.route as KnownRoute))
}
