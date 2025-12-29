// src/data/useStopsData.ts
// Hook for loading and caching stops GeoJSON data

import { useQuery } from '@tanstack/react-query'

/**
 * Stop feature properties from stops.geojson
 */
export interface StopProperties {
  id: number
  name: string
  osmId: number | null
  osmName: string | null
  matchScore: number
  matchMethod: 'exact' | 'fuzzy' | 'manual' | 'unmatched' | 'osm-only'
  seenCount: number
  priorityScore: number
  firstSeenAt: string
  lastSeenAt: string
  source: 'ridango' | 'osm'
}

/**
 * GeoJSON Feature for a stop
 */
export interface StopFeature {
  type: 'Feature'
  properties: StopProperties
  geometry: {
    type: 'Point'
    coordinates: [number, number] | null // [lon, lat]
  }
}

/**
 * Full stops GeoJSON structure
 */
export interface StopsGeoJSON {
  type: 'FeatureCollection'
  generatedAt: string
  matchStats: {
    total: number
    matched: number
    unmatched: number
    coveragePercent: number
  }
  features: StopFeature[]
}

/**
 * Route geometry from routes.geojson
 */
type RouteGeometry =
  | {
      type: 'LineString'
      coordinates: number[][]
    }
  | {
      type: 'MultiLineString'
      coordinates: number[][][]
    }

/**
 * Route feature properties from routes.geojson
 */
export interface RouteFeature {
  type: 'Feature'
  properties: {
    name: string
    route: string
    color?: string
  }
  geometry: RouteGeometry
}

/**
 * Full routes GeoJSON structure
 */
export interface RoutesGeoJSON {
  type: 'FeatureCollection'
  features: RouteFeature[]
}

/**
 * Fetch stops GeoJSON data
 */
async function fetchStopsData(): Promise<StopsGeoJSON> {
  const response = await fetch('/data/stops.geojson')
  
  if (!response.ok) {
    throw new Error(`Failed to load stops: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Fetch routes GeoJSON data
 */
async function fetchRoutesData(): Promise<RoutesGeoJSON> {
  const response = await fetch('/data/routes.geojson')

  if (!response.ok) {
    throw new Error(`Failed to load routes: ${response.status}`)
  }

  return response.json()
}

/**
 * Hook to load and cache stops data
 * Data is considered stable and cached indefinitely
 */
export function useStopsData() {
  return useQuery({
    queryKey: ['stops'],
    queryFn: fetchStopsData,
    staleTime: Infinity, // Stops data doesn't change frequently
    gcTime: Infinity,
    retry: 2,
  })
}

/**
 * Hook to load and cache routes data
 * Data is considered stable and cached indefinitely
 */
export function useRoutesData() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutesData,
    staleTime: Infinity, // Routes data doesn't change frequently
    gcTime: Infinity,
    retry: 2,
  })
}

/**
 * Create a lookup map from stop ID to stop feature
 */
export function createStopLookup(stops: StopsGeoJSON): Map<number, StopFeature> {
  const lookup = new Map<number, StopFeature>()
  
  for (const feature of stops.features) {
    if (feature.geometry.coordinates) {
      lookup.set(feature.properties.id, feature)
    }
  }
  
  return lookup
}

/**
 * Get stop coordinates by ID
 */
export function getStopCoordinates(
  stopId: number | null,
  lookup: Map<number, StopFeature>
): [number, number] | null {
  if (stopId === null) return null
  
  const feature = lookup.get(stopId)
  if (!feature || !feature.geometry.coordinates) return null
  
  // GeoJSON is [lon, lat], Leaflet expects [lat, lon]
  const [lon, lat] = feature.geometry.coordinates
  return [lat, lon]
}

/**
 * Get stop by ID
 */
export function getStopById(
  stopId: number | null,
  lookup: Map<number, StopFeature>
): StopFeature | null {
  if (stopId === null) return null
  return lookup.get(stopId) ?? null
}
