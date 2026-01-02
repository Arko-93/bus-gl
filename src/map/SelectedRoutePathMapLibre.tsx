import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { MapRoute, AnimatedRouteSvg } from '@/components/ui/map'
import { useAppStore } from '../state/appStore'
import { useStopsData } from '../data/useStopsData'
import { useRoute1Schedule, getStopOrderForDate } from '../data/route1Schedule'
import { useRoute2Schedule } from '../data/route2Schedule'
import { useRoute3Schedule } from '../data/route3Schedule'
import { useRouteX2Schedule } from '../data/routeX2Schedule'
import { useRouteE2Schedule } from '../data/routeE2Schedule'
import { useRouteX3Schedule } from '../data/routeX3Schedule'
import { getRouteLineColor } from '../data/routeColors'
import { useResolvedTheme } from '../hooks/useResolvedTheme'

type LatLng = [number, number]

const OSRM_BASE_URL = (import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org').replace(
  /\/$/,
  ''
)
const OSRM_PROFILE = import.meta.env.VITE_OSRM_PROFILE || 'driving'
const MAX_OSRM_COORDS = 80

const osrmRouteCache = new Map<string, LatLng[]>()

const QAJAASAT_EAST_LOOP: LatLng[] = [
  [64.1916104, -51.7101013],
  [64.1915567, -51.7100176],
  [64.1915258, -51.7099315],
  [64.1914999, -51.7098143],
  [64.1913766, -51.7092791],
  [64.1914114, -51.7091295],
  [64.1914857, -51.7090327],
  [64.1916717, -51.7087882],
  [64.1918344, -51.7085711],
  [64.1919080, -51.7084621],
  [64.1920090, -51.7087980],
  [64.1921290, -51.7093130],
  [64.1922100, -51.7097960],
  [64.1922270, -51.7100139],
]

const QAJAASAT_EAST_LOOP_REVERSE: LatLng[] = [...QAJAASAT_EAST_LOOP].reverse()

const NERNGALLAA_WAYPOINTS: LatLng[] = [
  [64.1922270, -51.7100139],
  [64.1922296, -51.7101225],
  [64.1922317, -51.7103159],
  [64.1922245, -51.7105423],
  [64.1922016, -51.7107892],
  [64.1921497, -51.7111533],
  [64.1920994, -51.7113554],
  [64.1920459, -51.7115349],
  [64.1919944, -51.7116747],
  [64.1919623, -51.7117587],
  [64.1918730, -51.7119578],
  [64.1917070, -51.7121840],
  [64.1916413, -51.7122480],
  [64.1915540, -51.7123149],
  [64.1914255, -51.7123629],
  [64.1913337, -51.7123608],
  [64.1912056, -51.7123431],
  [64.1911195, -51.7123036],
  [64.1908911, -51.7120748],
  [64.1907749, -51.7119366],
  [64.1907070, -51.7118602],
  [64.1906927, -51.7118444],
  [64.1906501, -51.7117979],
  [64.1904646, -51.7117090],
  [64.1902684, -51.7116964],
  [64.1900784, -51.7117777],
  [64.1899671, -51.7118770],
  [64.1898116, -51.7120599],
  [64.1896582, -51.7122542],
  [64.1895480, -51.7124279],
  [64.1893676, -51.7127198],
  [64.1892176, -51.7128853],
  [64.1890976, -51.7129902],
  [64.1890190, -51.7130288],
  [64.1889932, -51.7130354],
]

const NERNGALLAA_WAYPOINTS_REVERSE: LatLng[] = [...NERNGALLAA_WAYPOINTS].reverse()

const QAJAASAT_SOUTH_ENTRY: LatLng = [64.1916104, -51.7101013]

const NERNGALLAA_TO_QAJAASAT_SOUTH: LatLng[] = [
  ...NERNGALLAA_WAYPOINTS_REVERSE.filter(([lat]) => lat <= QAJAASAT_SOUTH_ENTRY[0]),
  QAJAASAT_SOUTH_ENTRY,
]

const NERNGALLAA_TO_EQALUGALINNGUIT: LatLng[] = [
  [64.1889932, -51.7130354],
  [64.1889390, -51.7129902],
  [64.1888742, -51.7129718],
  [64.1887966, -51.7129002],
  [64.1887705, -51.7128333],
  [64.1887538, -51.7126324],
  [64.1887401, -51.7120590],
  [64.1887350, -51.7117861],
]

const ROUTE_WAYPOINT_OVERRIDES: Record<
  string,
  Array<{ fromName: string; toName: string; via: LatLng | LatLng[] }>
> = {
  '1': [
    {
      fromName: 'Naluttarfik Malik',
      toName: 'Maligiaq',
      via: [64.1839326, -51.6978638],
    },
    {
      fromName: 'Maligiaq',
      toName: 'Tikiusaaq',
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
      via: [
        [64.1718429, -51.7348946],
        [64.1747954, -51.7368738],
        [64.1755706, -51.7361803],
      ],
    },
    {
      fromName: 'Røde etagehuse',
      toName: 'Tuujuk',
      via: [
        [64.1706171, -51.7314713],
        [64.1713957, -51.733641],
        [64.1718429, -51.7348946],
      ],
    },
    {
      fromName: 'Asiarpak',
      toName: 'Pukuffik',
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
  '2': [
    {
      fromName: 'Akunnerit',
      toName: 'Qajaasat',
      via: [...NERNGALLAA_TO_QAJAASAT_SOUTH, ...QAJAASAT_EAST_LOOP.slice(1)],
    },
    {
      fromName: 'Nuniaffik',
      toName: 'Qajaasat',
      via: [...NERNGALLAA_WAYPOINTS_REVERSE, ...QAJAASAT_EAST_LOOP_REVERSE.slice(1)],
    },
    {
      fromName: 'Qajaasat',
      toName: 'Eqalugalinnguit',
      via: [
        ...QAJAASAT_EAST_LOOP,
        ...NERNGALLAA_WAYPOINTS.slice(1),
        ...NERNGALLAA_TO_EQALUGALINNGUIT.slice(1),
      ],
    },
    {
      fromName: 'Qajaasat',
      toName: 'Paarnat',
      via: [...QAJAASAT_EAST_LOOP, ...NERNGALLAA_WAYPOINTS.slice(1)],
    },
  ],
  '3': [
    {
      fromName: 'Ilimmarfik',
      toName: 'Siaqqinneq Nukappiakkuluk',
      via: [64.1916837851373, -51.69477566525993] as LatLng,
    },
  ],
  'X2': [],
  'E2': [],
  'X3': [
    {
      fromName: 'Ilimmarfik',
      toName: 'Siaqqinneq Nukappiakkuluk',
      via: [64.1916837851373, -51.69477566525993] as LatLng,
    },
  ],
}

const ROUTE_STOP_COORD_OVERRIDES: Record<string, Array<{ stopName: string; coord: LatLng }>> = {
  '1': [
    {
      stopName: 'Maligiaq',
      coord: [64.1840093, -51.6980487],
    },
    {
      stopName: 'Tuujuk',
      coord: [64.1718429, -51.7348946],
    },
    {
      stopName: 'Røde etagehuse',
      coord: [64.1706171, -51.7314713],
    },
    {
      stopName: 'Kommuneqarfik',
      coord: [64.1755706, -51.7361803],
    },
    {
      stopName: 'Asiarpak',
      coord: [64.1769404, -51.679224],
    },
    {
      stopName: 'Pukuffik',
      coord: [64.1833869, -51.6966426],
    },
  ],
  '2': [],
  '3': [
    {
      stopName: 'Ilimmarfik',
      coord: [64.1916837851373, -51.69477566525993],
    },
  ],
  'X2': [],
  'E2': [],
  'X3': [
    {
      stopName: 'Ilimmarfik',
      coord: [64.1916837851373, -51.69477566525993],
    },
  ],
}

type RouteChunk = {
  type: 'osrm' | 'manual'
  points: LatLng[]
}

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

function coordsKey(point: LatLng): string {
  return `${roundCoord(point[0])},${roundCoord(point[1])}`
}

function normalizeOverridePoints(override: LatLng | LatLng[]): LatLng[] {
  if (Array.isArray(override) && Array.isArray(override[0])) {
    return override as LatLng[]
  }
  return [override as LatLng]
}

function mergeRouteChunks(chunks: LatLng[][]): LatLng[] {
  const merged: LatLng[] = []
  let lastKey: string | null = null
  for (const chunk of chunks) {
    for (const point of chunk) {
      const key = coordsKey(point)
      if (lastKey === key) continue
      merged.push(point)
      lastKey = key
    }
  }
  return merged
}

function buildRouteChunks(
  order: number[],
  coordIndex: Map<number, LatLng>,
  overrideByPair: Map<string, LatLng | LatLng[]>
): RouteChunk[] {
  const chunks: RouteChunk[] = []
  let currentOsrm: LatLng[] = []

  const flushOsrm = () => {
    if (currentOsrm.length > 1) {
      chunks.push({ type: 'osrm', points: currentOsrm })
    }
    currentOsrm = []
  }

  for (let i = 0; i < order.length - 1; i += 1) {
    const fromId = order[i]
    const toId = order[i + 1]
    const fromCoord = coordIndex.get(fromId)
    const toCoord = coordIndex.get(toId)
    if (!fromCoord || !toCoord) continue

    const override = overrideByPair.get(`${fromId}|${toId}`)
    if (override) {
      flushOsrm()
      const viaPoints = normalizeOverridePoints(override)
      chunks.push({ type: 'osrm', points: [fromCoord, ...viaPoints, toCoord] })
      continue
    }

    if (currentOsrm.length === 0) {
      currentOsrm.push(fromCoord)
    }
    currentOsrm.push(toCoord)

    if (currentOsrm.length >= MAX_OSRM_COORDS) {
      const last = currentOsrm[currentOsrm.length - 1]
      flushOsrm()
      currentOsrm.push(last)
    }
  }

  flushOsrm()
  return chunks
}

function buildRouteKey(points: LatLng[]): string {
  return points
    .map(([lat, lon]) => `${roundCoord(lat)},${roundCoord(lon)}`)
    .join('|')
}

function normalizeStopName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function applyStopOrderOverrides(
  route: string | null,
  order: number[],
  stopNameIndex: Map<string, number>
): number[] {
  if (!route || order.length === 0) return order

  if (route === '2') {
    const nuniaffikId = stopNameIndex.get(normalizeStopName('Nuniaffik'))
    const qajaasatId = stopNameIndex.get(normalizeStopName('Qajaasat'))
    if (!nuniaffikId || !qajaasatId) return order

    const nuniaffikIndex = order.indexOf(nuniaffikId)
    if (nuniaffikIndex === -1) return order
    if (order[nuniaffikIndex + 1] === qajaasatId) return order

    const updated = [...order]
    updated.splice(nuniaffikIndex + 1, 0, qajaasatId)
    return updated
  }

  return order
}

function buildCacheKey(points: LatLng[]): string {
  return points.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join('|')
}

async function fetchOsrmRoute(points: LatLng[], signal: AbortSignal): Promise<LatLng[] | null> {
  if (!OSRM_BASE_URL || points.length < 2) return null

  const cacheKey = buildCacheKey(points)
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
  osrmRouteCache.set(cacheKey, result)
  return result
}

function toLngLat([lat, lon]: LatLng): [number, number] {
  return [lon, lat]
}

export default function SelectedRoutePathMapLibre() {
  const selectedStopRoute = useAppStore((state) => state.selectedStopRoute)
  const selectedStopRouteTripEnabled = useAppStore((state) => state.selectedStopRouteTripEnabled)
  const selectedStopRouteFromId = useAppStore((state) => state.selectedStopRouteFromId)
  const selectedStopRouteToId = useAppStore((state) => state.selectedStopRouteToId)
  const resolvedTheme = useResolvedTheme()
  const { data: route1Schedule } = useRoute1Schedule()
  const { data: route2Schedule } = useRoute2Schedule()
  const { data: route3Schedule } = useRoute3Schedule()
  const { data: routeX2Schedule } = useRouteX2Schedule()
  const { data: routeE2Schedule } = useRouteE2Schedule()
  const { data: routeX3Schedule } = useRouteX3Schedule()
  const { data: stopsData } = useStopsData()
  const [routePaths, setRoutePaths] = useState<{ base: LatLng[] | null; pulse: LatLng[] | null }>({
    base: null,
    pulse: null,
  })
  const [isLoadingOsrm, setIsLoadingOsrm] = useState(false)
  const lastRouteKeyRef = useRef<string | null>(null)
  const routeAbortRef = useRef<AbortController | null>(null)

  const activeSchedule = useMemo(() => {
    if (selectedStopRoute === '1') return route1Schedule
    if (selectedStopRoute === '2') return route2Schedule
    if (selectedStopRoute === '3') return route3Schedule
    if (selectedStopRoute === 'X2') return routeX2Schedule
    if (selectedStopRoute === 'E2') return routeE2Schedule
    if (selectedStopRoute === 'X3') return routeX3Schedule
    return null
  }, [route1Schedule, route2Schedule, route3Schedule, routeX2Schedule, routeE2Schedule, routeX3Schedule, selectedStopRoute])

  const rawStopOrder = useMemo(() => {
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

  const stopOrder = useMemo(
    () => applyStopOrderOverrides(selectedStopRoute, rawStopOrder, stopNameIndex),
    [rawStopOrder, selectedStopRoute, stopNameIndex]
  )

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

  const routeChunks: RouteChunk[] = useMemo(
    () => buildRouteChunks(activeStopOrder, coordIndex, overrideByPair),
    [activeStopOrder, coordIndex, overrideByPair]
  )

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

  const shouldFetchRoute =
    !!selectedStopRoute && !!activeSchedule && routeKey && baseCoords.length >= 2

  useEffect(() => {
    if (!shouldFetchRoute) {
      routeAbortRef.current?.abort()
      routeAbortRef.current = null
      lastRouteKeyRef.current = null
      queueMicrotask(() => {
        setIsLoadingOsrm(false)
      })
      return
    }

    if (routeKey === lastRouteKeyRef.current) return
    lastRouteKeyRef.current = routeKey

    routeAbortRef.current?.abort()
    const controller = new AbortController()
    routeAbortRef.current = controller

    const straightBase = baseCoords.length > 1 ? baseCoords : null
    const straightPulse = pulseCoords.length > 1 ? pulseCoords : null
    queueMicrotask(() => {
      setRoutePaths({ base: straightBase, pulse: straightPulse })
      setIsLoadingOsrm(true)
    })

    const load = async () => {
      try {
        const canPulse = pulseCoords.length > 1
        const resolveChunks = async (): Promise<LatLng[]> => {
          if (routeChunks.length === 0) return []
          const resolvedChunks = await Promise.all(
            routeChunks.map(async (chunk) => {
              if (chunk.type === 'manual') return chunk.points
              try {
                const routed = await fetchOsrmRoute(chunk.points, controller.signal)
                return routed ?? chunk.points
              } catch (error) {
                console.warn('OSRM segment failed, using fallback points:', error)
                return chunk.points
              }
            })
          )
          return mergeRouteChunks(resolvedChunks)
        }
        const basePromise = resolveChunks()
        const pulsePromise = canPulse
          ? pulseKey && pulseKey !== baseKey
            ? resolveChunks()
            : basePromise
          : Promise.resolve(null)
        const [base, pulse] = await Promise.all([basePromise, pulsePromise])
        if (!controller.signal.aborted) {
          const resolvedBase = base.length > 1 ? base : baseCoords
          const resolvedPulse = canPulse ? (pulse && pulse.length > 1 ? pulse : pulseCoords) : null
          setRoutePaths({
            base: resolvedBase,
            pulse: resolvedPulse,
          })
          setIsLoadingOsrm(false)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Failed to load route path:', error)
          setRoutePaths({
            base: baseCoords,
            pulse: pulseCoords.length > 1 ? pulseCoords : null,
          })
          setIsLoadingOsrm(false)
        }
      }
    }

    load()

    return () => {
      controller.abort()
    }
  }, [
    shouldFetchRoute,
    routeKey,
    baseCoords,
    pulseCoords,
    baseKey,
    pulseKey,
    routeChunks,
  ])

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
    !activeSchedule ||
    !effectiveRoutePaths.base ||
    effectiveRoutePaths.base.length < 2
  )
    return null

  const routeColor = getRouteLineColor(selectedStopRoute, resolvedTheme === 'dark')

  return (
    <>
      {baseSegments &&
        baseSegments.map((segment, index) => (
          <MapRoute
            key={`route-base-${index}`}
            coordinates={segment.map(toLngLat)}
            color={routeColor}
            width={2}
            opacity={0.18}
          />
        ))}
      {effectiveRoutePaths.pulse && effectiveRoutePaths.pulse.length > 1 && (
        <AnimatedRouteSvg
          coordinates={effectiveRoutePaths.pulse.map(toLngLat)}
          color={routeColor}
          width={2.8}
          opacity={0.7}
          className={isLoadingOsrm ? 'route-path route-path--loading' : 'route-path route-path--pulse'}
        />
      )}
    </>
  )
}
