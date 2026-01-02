// src/data/route3Schedule.ts
// Route 3 schedule parsing from CSV timecodes.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStopsData } from './useStopsData'
import { parseRouteScheduleCsv } from './route1Schedule'

const ROUTE_3_SCHEDULE_URL = '/data/timecodes_bus_3.csv'
const ROUTE_3_ALIAS_MAP: Record<string, string> = {
  qatseritsut: 'qatserisut', // CSV has 't' in middle, stops.geojson doesn't
  nukappiakuluk: 'siaqqinneq nukappiakkuluk', // CSV uses short name
  'mittarfik / lufthavn': 'nuuk lufthavn', // CSV uses bilingual name
  'mittarfik': 'nuuk lufthavn', // Alternate
  'lufthavn': 'nuuk lufthavn', // Alternate
}

export function useRoute3Schedule() {
  const { data: stopsData } = useStopsData()
  const csvQuery = useQuery({
    queryKey: ['route-3-schedule'],
    queryFn: async () => {
      const response = await fetch(ROUTE_3_SCHEDULE_URL)
      if (!response.ok) {
        throw new Error(`Failed to load route 3 schedule: ${response.status}`)
      }
      return response.text()
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  })

  const schedule = useMemo(() => {
    if (!csvQuery.data || !stopsData) return null
    return parseRouteScheduleCsv(csvQuery.data, stopsData, { aliases: ROUTE_3_ALIAS_MAP })
  }, [csvQuery.data, stopsData])

  return {
    data: schedule,
    isLoading: csvQuery.isLoading || !stopsData,
    error: csvQuery.error,
  }
}
