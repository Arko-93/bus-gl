// src/hooks/useResolvedTheme.ts
// Hook that resolves 'system' theme preference to actual 'light' or 'dark'
// and applies the theme to the document

import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '../state/appStore'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

// Media query for system dark mode preference
const darkModeQuery = typeof window !== 'undefined' 
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

/**
 * Subscribe to system color scheme changes
 */
function subscribeToSystemTheme(callback: () => void): () => void {
  if (!darkModeQuery) return () => {}
  
  darkModeQuery.addEventListener('change', callback)
  return () => darkModeQuery.removeEventListener('change', callback)
}

/**
 * Get current system theme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (!darkModeQuery) return 'light'
  return darkModeQuery.matches ? 'dark' : 'light'
}

/**
 * Hook to get the resolved theme (always 'light' or 'dark')
 * Subscribes to system preference changes when theme is 'system'
 */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useAppStore((state) => state.theme)
  
  // Subscribe to system theme changes
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => 'light' as ResolvedTheme // SSR fallback
  )
  
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme
  
  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])
  
  return resolvedTheme
}

