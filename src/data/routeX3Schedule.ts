// src/data/routeX3Schedule.ts
// Route X3 schedule parsing from CSV timecodes.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStopsData } from './useStopsData'
import type { RouteSchedule, ScheduleService, ScheduleTime } from './route1Schedule'

const ROUTE_X3_SCHEDULE_URL = '/data/timecodes_bus_X3.csv'

function normalizeStopName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function parseStopName(raw: string): string {
  return raw.replace(/^\s*\d+\.?\s*/, '').trim()
}

function parseTimeValue(value: string): ScheduleTime | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Skip non-time values like "→ Rute 3"
  if (trimmed.includes('→') || trimmed.includes('Rute')) return null
  const normalized = trimmed.replace('.', ':')
  const parts = normalized.split(':').map((part) => Number(part))
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return null
  const [hours, minutes, seconds = 0] = parts
  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  const label = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return {
    label,
    seconds: totalSeconds,
    raw: normalized,
  }
}

function createStopLookup(stops: ReturnType<typeof useStopsData>['data']): Map<string, number> {
  const lookup = new Map<string, number>()
  if (!stops) return lookup

  for (const feature of stops.features) {
    const name = feature.properties.name
    const osmName = feature.properties.osmName
    if (name) lookup.set(normalizeStopName(name), feature.properties.id)
    if (osmName) lookup.set(normalizeStopName(osmName), feature.properties.id)
  }

  // Manual aliases for slight spelling differences between GTFS/CSV and OSM stop names
  const aliasTargets: Record<string, string> = {
    airgreenlandadm: 'airgreenlandadm',
    mittarfiklufthavn: 'nuuklufthavn',
    nukappiakuluk: 'siaqqinneqnukappiakkuluk',
  }

  for (const [alias, target] of Object.entries(aliasTargets)) {
    const targetId = lookup.get(normalizeStopName(target))
    if (targetId) {
      lookup.set(alias, targetId)
    }
  }

  return lookup
}

function buildStopOrder(header: string[], stopLookup: Map<string, number>): number[] {
  const order: number[] = []
  const seen = new Set<number>()

  for (let i = 1; i < header.length; i += 1) {
    const stopHeader = header[i] ?? ''
    const stopName = parseStopName(stopHeader)
    if (!stopName) continue
    const stopId = stopLookup.get(normalizeStopName(stopName))
    if (!stopId || seen.has(stopId)) continue
    order.push(stopId)
    seen.add(stopId)
  }

  return order
}

function parseScheduleCsv(csv: string, stopLookup: Map<string, number>): RouteSchedule {
  const schedule: RouteSchedule = {
    weekdays: {},
    weekends: {},
    stopOrder: { weekdays: [], weekends: [] },
  }
  const lines = csv.split(/\r?\n/)

  let currentService: ScheduleService | null = null
  let header: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) continue
    const columns = line.split(',').map((value) => value.trim())
    const first = columns[0]?.toLowerCase() ?? ''

    if (first.startsWith('weekdays')) {
      currentService = 'weekdays'
      header = []
      continue
    }
    if (first.startsWith('weekends')) {
      currentService = 'weekends'
      header = []
      continue
    }
    if (first.startsWith('round trip')) {
      header = columns
      if (currentService) {
        schedule.stopOrder[currentService] = buildStopOrder(columns, stopLookup)
      }
      continue
    }
    if (!currentService || header.length === 0) continue
    if (!/^\d+$/.test(columns[0] ?? '')) continue

    for (let i = 1; i < header.length; i += 1) {
      const timeValue = columns[i] ?? ''
      const parsedTime = parseTimeValue(timeValue)
      if (!parsedTime) continue
      const stopHeader = header[i] ?? ''
      const stopName = parseStopName(stopHeader)
      if (!stopName) continue
      const stopId = stopLookup.get(normalizeStopName(stopName))
      if (!stopId) continue

      const stopKey = String(stopId)
      const bucket = schedule[currentService][stopKey] ?? []
      bucket.push(parsedTime)
      schedule[currentService][stopKey] = bucket
    }
  }

  for (const service of ['weekdays', 'weekends'] as const) {
    for (const [stopId, times] of Object.entries(schedule[service])) {
      const unique = new Map<string, ScheduleTime>()
      for (const time of times) {
        unique.set(time.raw, time)
      }
      schedule[service][stopId] = Array.from(unique.values()).sort(
        (a, b) => a.seconds - b.seconds
      )
    }
  }

  // Fallback: if no weekend data, use weekday data
  if (schedule.stopOrder.weekends.length === 0 && schedule.stopOrder.weekdays.length > 0) {
    schedule.stopOrder.weekends = schedule.stopOrder.weekdays
    for (const [stopId, times] of Object.entries(schedule.weekdays)) {
      if (!schedule.weekends[stopId]) {
        schedule.weekends[stopId] = times
      }
    }
  }

  return schedule
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
    const stopLookup = createStopLookup(stopsData)
    return parseScheduleCsv(csvQuery.data, stopLookup)
  }, [csvQuery.data, stopsData])

  return {
    data: schedule,
    isLoading: csvQuery.isLoading || !stopsData,
    error: csvQuery.error,
  }
}
