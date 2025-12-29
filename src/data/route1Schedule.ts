// src/data/route1Schedule.ts
// Route 1 schedule parsing from CSV timecodes.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStopsData, type StopsGeoJSON } from './useStopsData'

export type ScheduleService = 'weekdays' | 'weekends'

export type ScheduleTime = {
  label: string
  seconds: number
  raw: string
}

export type RouteSchedule = {
  weekdays: Record<string, ScheduleTime[]>
  weekends: Record<string, ScheduleTime[]>
  stopOrder: Record<ScheduleService, number[]>
}

const ROUTE_1_SCHEDULE_URL = '/data/timecodes_bus_1.csv'

function normalizeStopName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function parseStopName(raw: string): string {
  return raw.replace(/^\s*\d+\.?\s*/, '').trim()
}

export function parseTimeValue(value: string): ScheduleTime | null {
  const trimmed = value.trim()
  if (!trimmed) return null
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

type StopAliasMap = Record<string, string>

type ParseRouteScheduleOptions = {
  aliases?: StopAliasMap
  parseTimeValue?: (value: string) => ScheduleTime | null
}

function createStopLookup(stops: StopsGeoJSON, aliases?: StopAliasMap): Map<string, number> {
  const lookup = new Map<string, number>()

  for (const feature of stops.features) {
    const name = feature.properties.name
    const osmName = feature.properties.osmName
    if (name) lookup.set(normalizeStopName(name), feature.properties.id)
    if (osmName) lookup.set(normalizeStopName(osmName), feature.properties.id)
  }

  if (aliases) {
    for (const [alias, target] of Object.entries(aliases)) {
      const targetId = lookup.get(normalizeStopName(target))
      if (targetId) {
        lookup.set(normalizeStopName(alias), targetId)
      }
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

function parseScheduleCsv(
  csv: string,
  stopLookup: Map<string, number>,
  parseTime: (value: string) => ScheduleTime | null = parseTimeValue
): RouteSchedule {
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
      const parsedTime = parseTime(timeValue)
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

  return schedule
}

export function parseRouteScheduleCsv(
  csv: string,
  stops: StopsGeoJSON,
  options: ParseRouteScheduleOptions = {}
): RouteSchedule {
  const stopLookup = createStopLookup(stops, options.aliases)
  return parseScheduleCsv(csv, stopLookup, options.parseTimeValue)
}

export function getScheduleServiceForDate(date: Date): ScheduleService {
  const day = date.getDay()
  return day === 0 || day === 6 ? 'weekends' : 'weekdays'
}

export function getStopOrderForDate(schedule: RouteSchedule | null, date: Date): number[] {
  if (!schedule) return []
  const service = getScheduleServiceForDate(date)
  return schedule.stopOrder[service] ?? []
}

export function getUpcomingTimes(
  schedule: RouteSchedule | null,
  stopId: number,
  date: Date,
  limit = 6
): { service: ScheduleService; times: Array<ScheduleTime & { isNext: boolean }>; serviceEnded: boolean } | null {
  if (!schedule) return null
  const service = getScheduleServiceForDate(date)
  const allTimes = schedule[service][String(stopId)] ?? []
  if (allTimes.length === 0) return null
  
  const nowSeconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
  const upcomingTimes = allTimes.filter((time) => time.seconds >= nowSeconds)
  
  // If no upcoming times, service has ended - show last times of the day
  if (upcomingTimes.length === 0) {
    const lastTimes = allTimes.slice(-limit).map((time) => ({
      ...time,
      isNext: false, // No next bus when service ended
    }))
    return { service, times: lastTimes, serviceEnded: true }
  }
  
  const upcoming = upcomingTimes.slice(0, limit).map((time, index) => ({
    ...time,
    isNext: index === 0,
  }))
  return { service, times: upcoming, serviceEnded: false }
}

export function useRoute1Schedule() {
  const { data: stopsData } = useStopsData()
  const csvQuery = useQuery({
    queryKey: ['route-1-schedule'],
    queryFn: async () => {
      const response = await fetch(ROUTE_1_SCHEDULE_URL)
      if (!response.ok) {
        throw new Error(`Failed to load route 1 schedule: ${response.status}`)
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
