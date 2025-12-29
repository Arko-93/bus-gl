// src/data/route2Schedule.ts
// Route 2 schedule parsing from CSV timecodes.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStopsData } from './useStopsData'
import { parseRouteScheduleCsv } from './route1Schedule'

const ROUTE_2_SCHEDULE_URL = '/data/timecodes_bus_2.csv'

export function useRoute2Schedule() {
  const { data: stopsData } = useStopsData()
  const csvQuery = useQuery({
    queryKey: ['route-2-schedule'],
    queryFn: async () => {
      const response = await fetch(ROUTE_2_SCHEDULE_URL)
      if (!response.ok) {
        throw new Error(`Failed to load route 2 schedule: ${response.status}`)
      }
      return response.text()
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  })

  const schedule = useMemo(() => {
    if (!csvQuery.data || !stopsData) return null
    return parseRouteScheduleCsv(csvQuery.data, stopsData)
  }, [csvQuery.data, stopsData])

  return {
    data: schedule,
    isLoading: csvQuery.isLoading || !stopsData,
    error: csvQuery.error,
  }
}
