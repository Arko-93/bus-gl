// src/map/SelectedRoutePath.tsx
// Highlight a selected route path across all its stops.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Polyline } from 'react-leaflet'
import { useAppStore } from '../state/appStore'
import { useStopsData } from '../data/useStopsData'
import { useRoute1Schedule, getStopOrderForDate } from '../data/route1Schedule'
import { useRoute2Schedule } from '../data/route2Schedule'

type LatLng = [number, number]

const OSRM_BASE_URL = (import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org').replace(
  /\/$/,
  ''
)
const OSRM_PROFILE = import.meta.env.VITE_OSRM_PROFILE || 'driving'

const ROUTE_WAYPOINT_OVERRIDES: Record<
  string,
  Array<{ fromName: string; toName: string; via: LatLng | LatLng[] }>
> = {
  '1': [
    {
      fromName: 'Naluttarfik Malik',
      toName: 'Maligiaq',
      // Keep the link on Borgmester Aniita Aqqusernga without detouring into Stanislawip Issikivia.
      via: [64.1839326, -51.6978638],
    },
    {
      fromName: 'Maligiaq',
      toName: 'Tikiusaaq',
      // Stay on Borgmester Aniita Aqqusernga when heading back; avoid Stanislawip Issikivia.
      via: [
        [64.1835419, -51.6971834],
        [64.1824822, -51.6949691],
        [64.1812975, -51.6940293],
        [64.1808209, -51.6935036],
        [64.1797812, -51.6897324],
      ],
    },
    {
      fromName: 'Tuujuk',
      toName: 'Kommuneqarfik',
      // Keep the route on Aqqusinersuaq between Tuujuk and Kommuneqarfik.
      via: [
        [64.1718429, -51.7348946],
        [64.1747954, -51.7368738],
        [64.1755706, -51.7361803],
      ],
    },
    {
      fromName: 'Røde etagehuse',
      toName: 'Tuujuk',
      // Avoid Kongevej; stay on Aqqusinersuaq.
      via: [
        [64.1706171, -51.7314713],
        [64.1713957, -51.733641],
        [64.1718429, -51.7348946],
      ],
    },
    {
      fromName: 'Asiarpak',
      toName: 'Pukuffik',
      // Avoid Stanislawip Isikkivia; stay on Borgmester Aniita Aqqusernga.
      via: [
        [64.1769404, -51.679224],
        [64.177231, -51.6819914],
        [64.1777499, -51.6842717],
        [64.1793548, -51.6881043],
        [64.1797812, -51.6897324],
        [64.1810101, -51.6937396],
        [64.182621, -51.6951558],
        [64.1833869, -51.6966426],
      ],
    },
  ],
  '2': [],
}

const ROUTE_STOP_COORD_OVERRIDES: Record<string, Array<{ stopName: string; coord: LatLng }>> = {
  '1': [
    {
      stopName: 'Maligiaq',
      // Keep routing on Borgmester Aniita Aqqusernga to avoid Sarfaarsuit.
      coord: [64.1840093, -51.6980487],
    },
    {
      stopName: 'Tuujuk',
      // Anchor on Aqqusinersuaq to avoid Kongevej.
      coord: [64.1718429, -51.7348946],
    },
    {
      stopName: 'Røde etagehuse',
      // Anchor on Aqqusinersuaq to avoid Kongevej.
      coord: [64.1706171, -51.7314713],
    },
    {
      stopName: 'Kommuneqarfik',
      // Anchor on Aqqusinersuaq after Tuujuk.
      coord: [64.1755706, -51.7361803],
    },
    {
      stopName: 'Asiarpak',
      // Avoid Stanislawip Isikkivia by anchoring on Borgmester Aniita Aqqusernga.
      coord: [64.1769404, -51.679224],
    },
    {
      stopName: 'Pukuffik',
      // Keep the route on Borgmester Aniita Aqqusernga near the stop.
      coord: [64.1833869, -51.6966426],
    },
  ],
  '2': [],
}

function getRouteColor(route: string): string {
  const colors: Record<string, string> = {
    '1': '#E91E8C',
    '2': '#FFD700',
    '3': '#4CAF50',
    'X2': '#808080',
    'E2': '#0066CC',
    'X3': '#00b047',
  }
  return colors[route] || '#6b7280'
}

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

function buildRouteKey(points: LatLng[]): string {
  return points
    .map(([lat, lon]) => `${roundCoord(lat)},${roundCoord(lon)}`)
    .join('|')
}

function normalizeStopName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

async function fetchOsrmRoute(points: LatLng[], signal: AbortSignal): Promise<LatLng[] | null> {
  if (!OSRM_BASE_URL || points.length < 2) return null

  const coordParam = points.map(([lat, lon]) => `${lon},${lat}`).join(';')
  const url = `${OSRM_BASE_URL}/route/v1/${OSRM_PROFILE}/${coordParam}?overview=full&geometries=geojson&steps=false`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`OSRM route failed: ${response.status}`)
  }

  const data = await response.json()
  const geometry = data?.routes?.[0]?.geometry
  if (!geometry?.coordinates?.length) return null

  return geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon])
}

export default function SelectedRoutePath() {
  const selectedStopRoute = useAppStore((state) => state.selectedStopRoute)
  const selectedStopRouteTripEnabled = useAppStore((state) => state.selectedStopRouteTripEnabled)
  const selectedStopRouteFromId = useAppStore((state) => state.selectedStopRouteFromId)
  const selectedStopRouteToId = useAppStore((state) => state.selectedStopRouteToId)
  const { data: route1Schedule } = useRoute1Schedule()
  const { data: route2Schedule } = useRoute2Schedule()
  const { data: stopsData } = useStopsData()
  const [routePaths, setRoutePaths] = useState<{ base: LatLng[] | null; pulse: LatLng[] | null }>({
    base: null,
    pulse: null,
  })
  const lastRouteKeyRef = useRef<string | null>(null)
  const routeAbortRef = useRef<AbortController | null>(null)

  const activeSchedule = useMemo(() => {
    if (selectedStopRoute === '1') return route1Schedule
    if (selectedStopRoute === '2') return route2Schedule
    return null
  }, [route1Schedule, route2Schedule, selectedStopRoute])

  const stopOrder = useMemo(() => {
    if (!activeSchedule) return []
    if (!selectedStopRoute) return []
    return getStopOrderForDate(activeSchedule, new Date())
  }, [activeSchedule, selectedStopRoute])

  const stopNameIndex = useMemo(() => {
    if (!stopsData) return new Map<string, number>()
    const index = new Map<string, number>()
    for (const feature of stopsData.features) {
      const name = feature.properties.name
      const osmName = feature.properties.osmName
      if (name) index.set(normalizeStopName(name), feature.properties.id)
      if (osmName) index.set(normalizeStopName(osmName), feature.properties.id)
    }
    return index
  }, [stopsData])

  const stopCoordOverrides = useMemo(() => {
    const overrides = ROUTE_STOP_COORD_OVERRIDES[selectedStopRoute ?? ''] ?? []
    const map = new Map<number, LatLng>()
    for (const override of overrides) {
      const stopId = stopNameIndex.get(normalizeStopName(override.stopName))
      if (stopId) {
        map.set(stopId, override.coord)
      }
    }
    return map
  }, [selectedStopRoute, stopNameIndex])

  const overrideByPair = useMemo(() => {
    const overrides = ROUTE_WAYPOINT_OVERRIDES[selectedStopRoute ?? ''] ?? []
    const map = new Map<string, LatLng | LatLng[]>()
    for (const override of overrides) {
      const fromId = stopNameIndex.get(normalizeStopName(override.fromName))
      const toId = stopNameIndex.get(normalizeStopName(override.toName))
      if (!fromId || !toId) continue
      map.set(`${fromId}|${toId}`, override.via)
    }
    return map
  }, [selectedStopRoute, stopNameIndex])

  const tripStopOrder = useMemo(() => {
    if (!selectedStopRouteTripEnabled) return null
    if (!selectedStopRouteFromId || !selectedStopRouteToId) return null
    if (stopOrder.length === 0) return null
    const fromIndex = stopOrder.indexOf(selectedStopRouteFromId)
    const toIndex = stopOrder.indexOf(selectedStopRouteToId)
    if (fromIndex === -1 || toIndex === -1) return null
    if (fromIndex <= toIndex) {
      return stopOrder.slice(fromIndex, toIndex + 1)
    }
    return stopOrder.slice(fromIndex).concat(stopOrder.slice(0, toIndex + 1))
  }, [
    selectedStopRouteTripEnabled,
    selectedStopRouteFromId,
    selectedStopRouteToId,
    stopOrder,
  ])

  const loopedStopOrder = useMemo(() => {
    if (stopOrder.length <= 1) return stopOrder
    return [...stopOrder, stopOrder[0]]
  }, [stopOrder])

  const activeStopOrder = tripStopOrder ?? loopedStopOrder

  const coordIndex = useMemo(() => {
    if (!stopsData) return new Map<number, LatLng>()
    const byId = new Map<number, LatLng>()
    for (const feature of stopsData.features) {
      const coords = feature.geometry.coordinates
      if (!coords) continue
      byId.set(feature.properties.id, [coords[1], coords[0]])
    }
    for (const [stopId, coord] of stopCoordOverrides.entries()) {
      byId.set(stopId, coord)
    }
    return byId
  }, [stopsData, stopCoordOverrides])

  const buildCoordsWithOverrides = useCallback((order: number[]): LatLng[] => {
    if (order.length === 0) return []
    const points: LatLng[] = []
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i]
      const coords = coordIndex.get(id)
      if (coords) points.push(coords)
      const nextId = order[i + 1]
      if (nextId) {
        const override = overrideByPair.get(`${id}|${nextId}`)
        if (override) {
          if (Array.isArray(override) && Array.isArray(override[0])) {
            points.push(...(override as LatLng[]))
          } else {
            points.push(override as LatLng)
          }
        }
      }
    }
    return points
  }, [coordIndex, overrideByPair])

  const baseCoords = useMemo(() => {
    if (activeStopOrder.length === 0) return []
    return buildCoordsWithOverrides(activeStopOrder)
  }, [activeStopOrder, buildCoordsWithOverrides])

  const pulseCoords = useMemo(() => {
    if (activeStopOrder.length === 0) return []
    return buildCoordsWithOverrides(activeStopOrder)
  }, [activeStopOrder, buildCoordsWithOverrides])

  const baseKey = useMemo(
    () => (baseCoords.length > 1 ? buildRouteKey(baseCoords) : null),
    [baseCoords]
  )

  const pulseKey = useMemo(
    () => (pulseCoords.length > 1 ? buildRouteKey(pulseCoords) : null),
    [pulseCoords]
  )

  const routeKey = useMemo(() => {
    if (!baseKey) return null
    return `${baseKey}|${pulseKey ?? ''}`
  }, [baseKey, pulseKey])

  // Determine if route should be shown
  const shouldFetchRoute =
    !!selectedStopRoute && ['1', '2'].includes(selectedStopRoute) && routeKey && baseCoords.length >= 2

  useEffect(() => {
    if (!shouldFetchRoute) {
      routeAbortRef.current?.abort()
      routeAbortRef.current = null
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
        const basePromise = fetchOsrmRoute(baseCoords, controller.signal)
        const canPulse = pulseCoords.length > 1
        const pulsePromise = canPulse
          ? pulseKey && pulseKey !== baseKey
            ? fetchOsrmRoute(pulseCoords, controller.signal)
            : basePromise
          : Promise.resolve(null)
        const [base, pulse] = await Promise.all([basePromise, pulsePromise])
        if (!controller.signal.aborted) {
          setRoutePaths({
            base: base ?? baseCoords,
            pulse: canPulse ? (pulse ?? pulseCoords) : null,
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Failed to load route path:', error)
          setRoutePaths({
            base: baseCoords,
            pulse: pulseCoords.length > 1 ? pulseCoords : null,
          })
        }
      }
    }

    load()

    return () => {
      controller.abort()
    }
  }, [shouldFetchRoute, routeKey, baseCoords, pulseCoords, baseKey, pulseKey])

  // Compute effective paths - null when route shouldn't be shown
  const effectiveRoutePaths = useMemo(() => {
    if (!shouldFetchRoute) return { base: null, pulse: null }
    return routePaths
  }, [shouldFetchRoute, routePaths])

  const baseSegments = useMemo(() => {
    if (!effectiveRoutePaths.base || effectiveRoutePaths.base.length < 2) return null
    const seen = new Set<string>()
    const segments: LatLng[][] = []
    let current: LatLng[] = []

    for (let i = 0; i < effectiveRoutePaths.base.length - 1; i += 1) {
      const a = effectiveRoutePaths.base[i]
      const b = effectiveRoutePaths.base[i + 1]
      const aKey = `${roundCoord(a[0])},${roundCoord(a[1])}`
      const bKey = `${roundCoord(b[0])},${roundCoord(b[1])}`
      const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`

      if (seen.has(key)) {
        if (current.length >= 2) segments.push(current)
        current = []
        continue
      }

      seen.add(key)
      if (current.length === 0) current.push(a)
      current.push(b)
    }

    if (current.length >= 2) segments.push(current)
    return segments
  }, [effectiveRoutePaths.base])

  if (
    !selectedStopRoute ||
    !['1', '2'].includes(selectedStopRoute) ||
    !effectiveRoutePaths.base ||
    effectiveRoutePaths.base.length < 2
  )
    return null

  const routeColor = getRouteColor(selectedStopRoute)

  return (
    <>
      {baseSegments && (
        <Polyline
          positions={baseSegments}
          pathOptions={{
            className: 'route-path route-path--base',
            color: routeColor,
            weight: 2,
            opacity: 0.18,
          }}
        />
      )}
      {effectiveRoutePaths.pulse && effectiveRoutePaths.pulse.length > 1 && (
        <Polyline
          positions={effectiveRoutePaths.pulse}
          pathOptions={{
            className: 'route-path route-path--pulse',
            color: routeColor,
            weight: 2.8,
            opacity: 0.7,
          }}
        />
      )}
    </>
  )
}
