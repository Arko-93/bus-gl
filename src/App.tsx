// src/App.tsx
// Main application component

import { Suspense, lazy, useEffect } from 'react'
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
    // Landscape mobile: short height + touch device OR narrow max-dimension
    const landscapeQuery = window.matchMedia('(max-height: 500px) and (orientation: landscape) and (pointer: coarse)')
    
    const handleChange = () => {
      setIsMobile(portraitQuery.matches || landscapeQuery.matches)
    }

    // Set initial value immediately
    handleChange()

    // Listen for changes
    portraitQuery.addEventListener('change', handleChange)
    landscapeQuery.addEventListener('change', handleChange)
    return () => {
      portraitQuery.removeEventListener('change', handleChange)
      landscapeQuery.removeEventListener('change', handleChange)
    }
  }, [setIsMobile])
}

function AppContent() {
  useMobileDetection()
  useKeyboardShortcuts()
  
  const isMobile = useAppStore((state) => state.isMobile)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)

  return (
    <div className="app">
      <TopBar />
      <ErrorBanner />
      <LoadingSkeleton />
      <Suspense fallback={<div className="map-container" />}>
        <MapViewMapLibre />
      </Suspense>
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
