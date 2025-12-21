// src/data/vehiclesQuery.ts
// TanStack Query hook for fetching realtime vehicle data

import { useQuery } from '@tanstack/react-query'
import { normalizeVehicles } from './ridangoRealtime'
import type { Vehicle } from './ridangoRealtime'
import { useAppStore } from '../state/appStore'

const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_MS) || 8000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Fetch vehicles from the API endpoint
 * Uses /api/nuuk-realtime which is proxied in dev or points to production worker
 */
async function fetchVehicles(): Promise<Vehicle[]> {
  const url = `${API_BASE_URL}/api/nuuk-realtime`
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Feed request failed: ${response.status} ${response.statusText}`)
  }

  const rawData = await response.json()
  return normalizeVehicles(rawData)
}

/**
 * Hook for fetching and polling vehicle data
 * - Polls every 8 seconds by default (configurable via VITE_POLL_MS)
 * - Retries with exponential backoff on failure
 * - Keeps stale data visible on error
 */
export function useVehiclesQuery() {
  const setFeedError = useAppStore((state) => state.setFeedError)
  const setLastSuccessTime = useAppStore((state) => state.setLastSuccessTime)

  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      try {
        const vehicles = await fetchVehicles()
        setFeedError(null)
        setLastSuccessTime(Date.now())
        return vehicles
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setFeedError(message)
        throw error
      }
    },
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: true,
    staleTime: POLL_INTERVAL - 1000, // Consider data stale just before next poll
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Keep previous data on error so map stays populated
    placeholderData: (previousData) => previousData,
  })
}
