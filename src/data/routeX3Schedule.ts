// src/data/routeX3Schedule.ts
// Route X3 schedule parsing from CSV timecodes.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStopsData } from './useStopsData'
import { parseRouteScheduleCsv, parseTimeValue, type ScheduleTime } from './route1Schedule'

const ROUTE_X3_SCHEDULE_URL = '/data/timecodes_bus_X3.csv'

const ROUTE_X3_ALIAS_MAP: Record<string, string> = {
  nukappiakuluk: 'siaqqinneq nukappiakkuluk', // CSV uses short name
  'mittarfik / lufthavn': 'nuuk lufthavn', // CSV uses bilingual name
  'mittarfik': 'nuuk lufthavn', // Alternate
  'lufthavn': 'nuuk lufthavn', // Alternate
}

function parseRouteX3TimeValue(value: string): ScheduleTime | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Skip non-time values like "→ Rute 3"
  if (trimmed.includes('→') || trimmed.includes('Rute')) return null
  return parseTimeValue(trimmed)
}

export function useRouteX3Schedule() {
  const { data: stopsData } = useStopsData()
  const csvQuery = useQuery({
    queryKey: ['route-X3-schedule'],
    queryFn: async () => {
      const response = await fetch(ROUTE_X3_SCHEDULE_URL)
      if (!response.ok) {
        throw new Error(`Failed to load route X3 schedule: ${response.status}`)
      }
      return response.text()
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  })

  const schedule = useMemo(() => {
    if (!csvQuery.data || !stopsData) return null
    return parseRouteScheduleCsv(csvQuery.data, stopsData, {
      aliases: ROUTE_X3_ALIAS_MAP,
      parseTimeValue: parseRouteX3TimeValue,
    })
  }, [csvQuery.data, stopsData])

  return {
    data: schedule,
    isLoading: csvQuery.isLoading || !stopsData,
    error: csvQuery.error,
  }
}
