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
  const setIsLandscapeMobile = useAppStore((state) => state.setIsLandscapeMobile)

  useEffect(() => {
    // Portrait mobile: narrow width
    const portraitQuery = window.matchMedia('(max-width: 768px)')
    // Landscape mobile: short height + landscape orientation
    const landscapeQuery = window.matchMedia('(max-height: 500px) and (orientation: landscape)')
    
    const handleChange = () => {
      // Check for touch capability as fallback for iOS Safari
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Use multiple detection methods for landscape mobile (Safari workaround)
      // 1. Media query based detection
      const mediaQueryLandscape = landscapeQuery.matches
      // 2. Direct dimension check - landscape if wider than tall and short height
      const dimensionLandscape = window.innerWidth > window.innerHeight && window.innerHeight <= 500
      // 3. Screen orientation API (more reliable on iOS)
      const screenOrientationLandscape = window.screen?.orientation?.type?.includes('landscape') ?? false
      // 4. Legacy orientation check
      const legacyOrientationLandscape = typeof window.orientation === 'number' && (window.orientation === 90 || window.orientation === -90)
      
      // Consider it landscape mobile if any method detects landscape AND it's a touch device with short height
      const isLandscape = mediaQueryLandscape || dimensionLandscape || screenOrientationLandscape || legacyOrientationLandscape
      const hasShortHeight = window.innerHeight <= 500 || (isTouchDevice && window.innerHeight < window.innerWidth && window.innerHeight <= 450)
      const isLandscapeMobile = isLandscape && isTouchDevice && hasShortHeight
      const isMobile = portraitQuery.matches || isLandscapeMobile
      
      setIsMobile(isMobile)
      setIsLandscapeMobile(isLandscapeMobile)
      
      // Apply class to document for CSS targeting (Safari fallback)
      document.documentElement.classList.toggle('landscape-mobile', isLandscapeMobile)
      document.documentElement.classList.toggle('portrait-mobile', portraitQuery.matches && !isLandscapeMobile)
    }

    // Delayed handler for orientation change (Safari needs time to update dimensions)
    const handleOrientationChange = () => {
      handleChange()
      // Re-check after Safari updates dimensions
      setTimeout(handleChange, 100)
      setTimeout(handleChange, 300)
    }

    // Set initial value immediately
    handleChange()

    // Listen for changes
    portraitQuery.addEventListener('change', handleChange)
    landscapeQuery.addEventListener('change', handleChange)
    // Also listen for orientation changes (iOS Safari) - with delayed re-check
    window.addEventListener('orientationchange', handleOrientationChange)
    // Listen for resize as additional fallback
    window.addEventListener('resize', handleChange)
    return () => {
      portraitQuery.removeEventListener('change', handleChange)
      landscapeQuery.removeEventListener('change', handleChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.removeEventListener('resize', handleChange)
    }
  }, [setIsMobile, setIsLandscapeMobile])
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

    // Set map ready immediately - the Map component handles its own loading state
    // This ensures we don't show a blank page on initial load
    setIsMapReady(true)
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
        <Suspense fallback={
          <div className="map-container map-container--loading">
            <div className="map-loading-indicator">
              <img src="/bussit.webp" alt="Bussit" style={{ height: 48, width: 'auto', opacity: 0.8 }} />
            </div>
          </div>
        }>
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
        <div className="map-container map-container--loading">
          <div className="map-loading-indicator">
            <img src="/bussit.webp" alt="Bussit" style={{ height: 48, width: 'auto', opacity: 0.8 }} />
          </div>
        </div>
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
