// src/App.tsx
// Main application component

import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapView from './map/MapView'
import TopBar from './ui/TopBar'
import RouteFilter from './ui/RouteFilter'
import StopFilter from './ui/StopFilter'
import BottomSheet from './ui/BottomSheet'
import ErrorBanner from './ui/ErrorBanner'
import LoadingSkeleton from './ui/LoadingSkeleton'
import { useAppStore } from './state/appStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import './App.css'

const ENABLE_STATIC_LAYERS = import.meta.env.VITE_ENABLE_STATIC_LAYERS === 'true'

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
 */
function useMobileDetection() {
  const setIsMobile = useAppStore((state) => state.setIsMobile)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }

    // Set initial value immediately
    handleChange(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
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
      <MapView />
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
