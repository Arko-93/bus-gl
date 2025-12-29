// src/map/SelectedBusPath.tsx
// Highlight the selected bus path towards current destination and next stop.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Polyline } from 'react-leaflet'
import L from 'leaflet'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import {
  useStopsData,
  useRoutesData,
  createStopLookup,
  getStopCoordinates,
  type StopFeature,
  type RouteFeature,
} from '../data/useStopsData'
import { getRouteLineColor } from '../data/routeColors'

type LatLng = [number, number]

const OSRM_BASE_URL = (import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '')
const OSRM_PROFILE = import.meta.env.VITE_OSRM_PROFILE || 'driving'

// In-memory cache for OSRM route responses
const osrmRouteCache = new Map<string, LatLng[]>()

function projectPoint(latlng: LatLng): L.Point {
  return L.CRS.EPSG3857.project(L.latLng(latlng[0], latlng[1]))
}

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function lineLength(line: LatLng[]): number {
  let total = 0
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = projectPoint(line[i])
    const b = projectPoint(line[i + 1])
    total += a.distanceTo(b)
  }
  return total
}

function normalizeLine(geometry: RouteFeature['geometry']): LatLng[] | null {
  if (geometry.type === 'LineString') {
    return geometry.coordinates.map(([lon, lat]) => [lat, lon])
  }

  if (geometry.type === 'MultiLineString') {
    let best: LatLng[] | null = null
    let bestLength = 0
    for (const line of geometry.coordinates) {
      const converted = line.map(([lon, lat]) => [lat, lon] as LatLng)
      const length = lineLength(converted)
      if (length > bestLength) {
        bestLength = length
        best = converted
      }
    }
    return best
  }

  return null
}

function extractStopName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const match = raw.match(/^\d+:\s*(.+)$/)
  return (match ? match[1] : raw).trim() || null
}

function normalizeStopName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  const prev = new Array(bLen + 1)
  const curr = new Array(bLen + 1)

  for (let j = 0; j <= bLen; j += 1) {
    prev[j] = j
  }

  for (let i = 1; i <= aLen; i += 1) {
    curr[0] = i
    const aChar = a.charCodeAt(i - 1)
    for (let j = 1; j <= bLen; j += 1) {
      const bChar = b.charCodeAt(j - 1)
      const cost = aChar === bChar ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }
    for (let j = 0; j <= bLen; j += 1) {
      prev[j] = curr[j]
    }
  }

  return prev[bLen]
}

type NormalizedStop = {
  feature: StopFeature
  keys: string[]
}

function buildStopNameIndex(stops: StopFeature[]): NormalizedStop[] {
  const index: NormalizedStop[] = []

  for (const feature of stops) {
    const keys = [feature.properties.name, feature.properties.osmName]
      .filter(Boolean)
      .map((name) => normalizeStopName(name!))
      .filter((key) => key.length > 0)

    if (keys.length > 0) {
      index.push({ feature, keys })
    }
  }

  return index
}

function scoreStopName(target: string, candidate: string): number {
  if (!target || !candidate) return 0
  if (target === candidate) return 1
  if (candidate.startsWith(target) || target.startsWith(candidate)) return 0.9
  if (candidate.includes(target) || target.includes(candidate)) return 0.82

  const maxLen = Math.max(target.length, candidate.length)
  if (maxLen === 0) return 0
  const distance = levenshtein(target, candidate)
  return 1 - distance / maxLen
}

function getStopCoordinatesByName(
  rawName: string | null | undefined,
  stopIndex: NormalizedStop[]
): LatLng | null {
  const extracted = extractStopName(rawName)
  if (!extracted) return null

  const normalized = normalizeStopName(extracted)
  if (!normalized || normalized === 'unknown' || normalized === 'na' || normalized === 'n/a') {
    return null
  }

  let best: StopFeature | null = null
  let bestScore = 0

  for (const entry of stopIndex) {
    for (const key of entry.keys) {
      if (key === normalized) {
        const coords = entry.feature.geometry.coordinates
        if (coords) return [coords[1], coords[0]]
      }

      const score = scoreStopName(normalized, key)
      if (score > bestScore) {
        bestScore = score
        best = entry.feature
      }
    }
  }

  if (bestScore < 0.74 || !best?.geometry.coordinates) return null
  const [lon, lat] = best.geometry.coordinates
  return [lat, lon]
}

type LinePosition = {
  index: number
  t: number
  distance: number
}

function locateOnLine(line: LatLng[], target: LatLng): LinePosition | null {
  if (line.length < 2) return null

  const p = projectPoint(target)
  let total = 0
  let best: { distance: number; index: number; t: number; along: number } | null = null

  for (let i = 0; i < line.length - 1; i += 1) {
    const a = projectPoint(line[i])
    const b = projectPoint(line[i + 1])
    const ab = b.subtract(a)
    const ab2 = ab.x * ab.x + ab.y * ab.y
    const ap = p.subtract(a)
    let t = ab2 === 0 ? 0 : (ap.x * ab.x + ap.y * ab.y) / ab2
    t = Math.max(0, Math.min(1, t))
    const closest = a.add(ab.multiplyBy(t))
    const dist = closest.distanceTo(p)
    const segmentLength = a.distanceTo(b)
    const along = total + segmentLength * t

    if (!best || dist < best.distance) {
      best = { distance: dist, index: i, t, along }
    }

    total += segmentLength
  }

  if (!best) return null
  return { index: best.index, t: best.t, distance: best.along }
}

function sliceLine(line: LatLng[], start: LinePosition, end: LinePosition): LatLng[] | null {
  if (line.length < 2) return null

  const reversed = start.distance > end.distance
  const from = reversed ? end : start
  const to = reversed ? start : end

  const points: LatLng[] = []
  const startPoint = interpolate(line[from.index], line[from.index + 1], from.t)
  points.push(startPoint)

  for (let i = from.index + 1; i <= to.index; i += 1) {
    points.push(line[i])
  }

  const endPoint = interpolate(line[to.index], line[to.index + 1], to.t)
  points.push(endPoint)

  if (reversed) {
    points.reverse()
  }

  return points
}

function buildSegment(routeLine: LatLng[] | null, from: LatLng, to: LatLng): LatLng[] | null {
  if (!from || !to) return null

  if (!routeLine || routeLine.length < 2) return null

  const start = locateOnLine(routeLine, from)
  const end = locateOnLine(routeLine, to)
  if (!start || !end) return null

  const segment = sliceLine(routeLine, start, end)
  if (!segment || segment.length < 2) return null

  return segment
}

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

function buildRouteKey(points: LatLng[]): string {
  return points
    .map(([lat, lon]) => `${roundCoord(lat)},${roundCoord(lon)}`)
    .join('|')
}

async function fetchOsrmRoute(points: LatLng[], signal: AbortSignal): Promise<LatLng[] | null> {
  if (!OSRM_BASE_URL || points.length < 2) return null

  // Check cache first
  const cacheKey = buildRouteKey(points)
  const cached = osrmRouteCache.get(cacheKey)
  if (cached) return cached

  const coordParam = points.map(([lat, lon]) => `${lon},${lat}`).join(';')
  const url = `${OSRM_BASE_URL}/route/v1/${OSRM_PROFILE}/${coordParam}?overview=full&geometries=geojson&steps=false`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`OSRM route failed: ${response.status}`)
  }

  const data = await response.json()
  const geometry = data?.routes?.[0]?.geometry
  if (!geometry?.coordinates?.length) return null

  const result = geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]) as LatLng[]
  
  // Cache the result
  osrmRouteCache.set(cacheKey, result)
  
  return result
}

export default function SelectedBusPath() {
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const { data: vehicles = [] } = useVehiclesQuery()
  const { data: stopsData } = useStopsData()
  const { data: routesData, error: routesError } = useRoutesData()
  const [roadSegments, setRoadSegments] = useState<{ primary: LatLng[] | null; next: LatLng[] | null }>({
    primary: null,
    next: null,
  })
  const lastRouteKeyRef = useRef<string | null>(null)
  const routeAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (routesError) {
      console.warn('Failed to load route paths:', routesError)
    }
  }, [routesError])

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )

  const stopLookup = useMemo(() => {
    if (!stopsData) return new Map()
    return createStopLookup(stopsData)
  }, [stopsData])

  const stopNameIndex = useMemo(() => {
    if (!stopsData) return []
    return buildStopNameIndex(stopsData.features)
  }, [stopsData])

  const currentStop = useMemo(
    () =>
      getStopCoordinates(selectedVehicle?.stopId ?? null, stopLookup) ||
      getStopCoordinatesByName(selectedVehicle?.stopNameRaw, stopNameIndex),
    [selectedVehicle?.stopId, selectedVehicle?.stopNameRaw, stopLookup, stopNameIndex]
  )
  const nextStop = useMemo(
    () =>
      getStopCoordinates(selectedVehicle?.nextStopId ?? null, stopLookup) ||
      getStopCoordinatesByName(selectedVehicle?.nextStopNameRaw, stopNameIndex),
    [selectedVehicle?.nextStopId, selectedVehicle?.nextStopNameRaw, stopLookup, stopNameIndex]
  )

  const routeLine = useMemo(() => {
    if (!routesData || !selectedVehicle) return null
    const feature = routesData.features.find((f) => f.properties.route === selectedVehicle.route)
    if (!feature) return null
    return normalizeLine(feature.geometry)
  }, [routesData, selectedVehicle])

  const primaryStop = currentStop ?? nextStop
  const secondaryStop = currentStop ? nextStop : null

  const busPosition = useMemo<LatLng | null>(() => {
    if (!selectedVehicle) return null
    return [selectedVehicle.lat, selectedVehicle.lon]
  }, [selectedVehicle])

  const routeKey = useMemo(() => {
    if (!busPosition || !primaryStop) return null
    const primaryKey = buildRouteKey([busPosition, primaryStop])
    const nextKey = secondaryStop ? buildRouteKey([primaryStop, secondaryStop]) : ''
    return `${primaryKey}|${nextKey}`
  }, [busPosition, primaryStop, secondaryStop])

  useEffect(() => {
    if (!selectedVehicle || selectedVehicle.atStop || !busPosition || !routeKey || !primaryStop) {
      routeAbortRef.current?.abort()
      routeAbortRef.current = null
      queueMicrotask(() => {
        setRoadSegments({ primary: null, next: null })
      })
      lastRouteKeyRef.current = null
      return
    }

    if (routeKey === lastRouteKeyRef.current) return
    lastRouteKeyRef.current = routeKey

    routeAbortRef.current?.abort()
    const controller = new AbortController()
    routeAbortRef.current = controller

    const load = async () => {
      try {
        const primaryPromise = fetchOsrmRoute([busPosition, primaryStop], controller.signal)
        const nextPromise = secondaryStop
          ? fetchOsrmRoute([primaryStop, secondaryStop], controller.signal)
          : Promise.resolve(null)
        const [primary, next] = await Promise.all([primaryPromise, nextPromise])
        if (!controller.signal.aborted) {
          setRoadSegments({ primary, next })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Failed to load snapped route:', error)
          setRoadSegments({ primary: null, next: null })
        }
      }
    }

    load()

    return () => {
      controller.abort()
    }
  }, [
    routeKey,
    busPosition,
    primaryStop,
    secondaryStop,
    selectedVehicle,
  ])

  if (!selectedVehicle || selectedVehicle.atStop || !primaryStop || !busPosition) return null

  const primaryFallback = buildSegment(routeLine, busPosition, primaryStop)
  const nextFallback = secondaryStop ? buildSegment(routeLine, primaryStop, secondaryStop) : null
  const primarySegment = roadSegments.primary ?? primaryFallback
  const nextSegment = roadSegments.next ?? nextFallback
  const routeColor = getRouteLineColor(selectedVehicle.route)

  return (
    <>
      {primarySegment && (
        <Polyline
          positions={primarySegment}
          pathOptions={{
            className: 'bus-path bus-path--current',
            color: routeColor,
            weight: 5,
            opacity: 0.9,
            interactive: false, // Don't capture clicks - let stop circles receive them
          }}
        />
      )}
      {nextSegment && (
        <Polyline
          positions={nextSegment}
          pathOptions={{
            className: 'bus-path bus-path--next',
            color: routeColor,
            weight: 4,
            opacity: 0.35,
            interactive: false, // Don't capture clicks - let stop circles receive them
          }}
        />
      )}
    </>
  )
}
