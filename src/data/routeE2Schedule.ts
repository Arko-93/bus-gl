// src/data/routeE2Schedule.ts
// Route E2 schedule parsing from CSV timecodes.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStopsData } from './useStopsData'
import { parseRouteScheduleCsv } from './route1Schedule'

const ROUTE_E2_SCHEDULE_URL = '/data/timecodes_bus_E2.csv'

export function useRouteE2Schedule() {
  const { data: stopsData } = useStopsData()
  const csvQuery = useQuery({
    queryKey: ['route-E2-schedule'],
    queryFn: async () => {
      const response = await fetch(ROUTE_E2_SCHEDULE_URL)
      if (!response.ok) {
        throw new Error(`Failed to load route E2 schedule: ${response.status}`)
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
