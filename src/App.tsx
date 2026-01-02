// src/App.tsx
// Main application component

import { Suspense, lazy, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TopBar from './ui/TopBar'
import RouteFilter from './ui/RouteFilter'
import StopFilter from './ui/StopFilter'
import BottomSheet from './ui/BottomSheet'
import ErrorBanner from './ui/ErrorBanner'
import LoadingSkeleton from './ui/LoadingSkeleton'
import { useAppStore } from './state/appStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import './App.css'

const MapViewMapLibre = lazy(() => import('./map/MapViewMapLibre'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 3,
    },
  },
})

/**
 * Hook to detect mobile viewport and update store
 * Detects both portrait and landscape mobile modes
 */
function useMobileDetection() {
  const setIsMobile = useAppStore((state) => state.setIsMobile)

  useEffect(() => {
    // Portrait mobile: narrow width
    const portraitQuery = window.matchMedia('(max-width: 768px)')
    // Landscape mobile: short height + landscape orientation
    // Use hover: none as fallback for touch devices (more reliable than pointer: coarse on iOS Safari)
    const landscapeQuery = window.matchMedia('(max-height: 500px) and (orientation: landscape)')
    
    const handleChange = () => {
      // Also check for touch capability as fallback
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isLandscapeMobile = landscapeQuery.matches && isTouchDevice
      setIsMobile(portraitQuery.matches || isLandscapeMobile)
    }

    // Set initial value immediately
    handleChange()

    // Listen for changes
    portraitQuery.addEventListener('change', handleChange)
    landscapeQuery.addEventListener('change', handleChange)
    // Also listen for orientation changes (iOS Safari)
    window.addEventListener('orientationchange', handleChange)
    return () => {
      portraitQuery.removeEventListener('change', handleChange)
      landscapeQuery.removeEventListener('change', handleChange)
      window.removeEventListener('orientationchange', handleChange)
    }
  }, [setIsMobile])
}

function AppContent() {
  useMobileDetection()
  useKeyboardShortcuts()

  const [isMapReady, setIsMapReady] = useState(false)
  const [isMapDeferred, setIsMapDeferred] = useState(false)

  useEffect(() => {
    const connection = (
      navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
    ).connection
    const isSlowConnection =
      connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g'

    if (isSlowConnection) {
      setIsMapDeferred(true)
      return
    }

    const { requestIdleCallback, cancelIdleCallback } = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (requestIdleCallback) {
      const idleHandle = requestIdleCallback(() => setIsMapReady(true), { timeout: 1200 })
      return () => cancelIdleCallback?.(idleHandle)
    }

    const timeoutId = window.setTimeout(() => setIsMapReady(true), 250)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const handleLoadMap = () => {
    setIsMapDeferred(false)
    setIsMapReady(true)
  }

  const isMobile = useAppStore((state) => state.isMobile)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)

  return (
    <div className="app">
      <TopBar />
      <ErrorBanner />
      <LoadingSkeleton />
      {isMapReady ? (
        <Suspense fallback={<div className="map-container" />}>
          <MapViewMapLibre />
        </Suspense>
      ) : isMapDeferred ? (
        <div className="map-container map-container--placeholder">
          <div className="map-placeholder">
            <div className="map-placeholder__title">Load map when ready</div>
            <p className="map-placeholder__body">
              Slow connection detected. Tap to load the map.
            </p>
            <button className="map-load-button" type="button" onClick={handleLoadMap}>
              Load map
            </button>
          </div>
        </div>
      ) : (
        <div className="map-container" />
      )}
      {/* Hide filter bar on mobile when bottom sheet is open */}
      {!(isMobile && isBottomSheetOpen) && (
        <div className="filter-bar">
          <RouteFilter />
          <StopFilter />
        </div>
      )}
      <BottomSheet />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
