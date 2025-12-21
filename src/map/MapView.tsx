// src/map/MapView.tsx
// Main map component with Leaflet

import { useEffect, useMemo, memo, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { filterVehiclesByRoute } from '../state/appStore'
import { useResolvedTheme } from '../hooks/useResolvedTheme'
import BusMarker from './BusMarker'
import StopsLayer from './StopsLayer'
import RoutesLayer from './RoutesLayer'

// Nuuk, Greenland coordinates
const NUUK_CENTER: [number, number] = [64.1814, -51.6941]
const DEFAULT_ZOOM = 13

/**
 * Tile Provider Configuration
 * 
 * Environment variables:
 * - VITE_TILE_LIGHT_URL: Light theme tile URL (default: CartoDB Voyager)
 * - VITE_TILE_DARK_URL: Dark theme tile URL (default: CartoDB Dark Matter)
 * - VITE_TILE_ATTRIBUTION: Tile attribution (default: OpenStreetMap + CARTO)
 * - VITE_TILE_SUBDOMAINS: Tile subdomains (default: 'abcd' for CARTO)
 * - VITE_TILE_MAX_ZOOM: Max zoom level (default: 19)
 * 
 * Default providers (CARTO):
 * - Light: https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
 * - Dark: https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
 * 
 * Alternative example (OpenStreetMap standard - same for light/dark):
 * - URL: https://tile.openstreetmap.org/{z}/{x}/{y}.png
 * - Attribution: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
 * - Subdomains: '' (none)
 * 
 * Note: Attribution must be updated when changing tile providers!
 */

// Fallback to OpenStreetMap if env vars are missing
const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// CARTO tile URLs (defaults)
const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Read from env with CARTO defaults, fallback to OSM if both are missing
const TILE_LIGHT_URL = import.meta.env.VITE_TILE_LIGHT_URL || CARTO_LIGHT_URL
const TILE_DARK_URL = import.meta.env.VITE_TILE_DARK_URL || CARTO_DARK_URL
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || CARTO_ATTRIBUTION
const TILE_SUBDOMAINS = import.meta.env.VITE_TILE_SUBDOMAINS || 'abcd'
const TILE_MAX_ZOOM = parseInt(import.meta.env.VITE_TILE_MAX_ZOOM || '19', 10)

// Feature flags
const ENABLE_STATIC_LAYERS = import.meta.env.VITE_ENABLE_STATIC_LAYERS === 'true'

/**
 * Get tile URL based on theme, with fallback
 */
function getTileUrl(theme: 'light' | 'dark'): string {
  const url = theme === 'dark' ? TILE_DARK_URL : TILE_LIGHT_URL
  // If URL is empty or invalid, fall back to OSM
  if (!url || url === '') {
    return OSM_FALLBACK_URL
  }
  return url
}

/**
 * Get attribution, with fallback
 */
function getAttribution(): string {
  if (!TILE_ATTRIBUTION || TILE_ATTRIBUTION === '') {
    return OSM_FALLBACK_ATTRIBUTION
  }
  return TILE_ATTRIBUTION
}

/**
 * Component to invalidate map size on container changes
 */
function MapResizer() {
  const map = useMap()

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize()
    }

    window.addEventListener('resize', handleResize)
    // Invalidate on mount to ensure correct sizing
    setTimeout(handleResize, 100)

    return () => window.removeEventListener('resize', handleResize)
  }, [map])

  return null
}

/**
 * Vehicle markers layer - memoized for performance
 * Also handles auto-fitting bounds on initial load
 */
const VehicleMarkers = memo(function VehicleMarkers() {
  const map = useMap()
  const { data: vehicles = [], isLoading } = useVehiclesQuery()
  const enabledRoutes = useAppStore((state) => state.enabledRoutes)
  const hasFittedBounds = useRef(false)
  
  const filteredVehicles = useMemo(
    () => filterVehiclesByRoute(vehicles, enabledRoutes),
    [vehicles, enabledRoutes]
  )

  // Auto-fit bounds on initial data load
  useEffect(() => {
    if (!hasFittedBounds.current && filteredVehicles.length > 0) {
      const bounds = L.latLngBounds(
        filteredVehicles.map((v) => [v.lat, v.lon] as [number, number])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
        hasFittedBounds.current = true
      }
    }
  }, [filteredVehicles, map])

  if (isLoading && filteredVehicles.length === 0) {
    return null // Will show loading in TopBar
  }

  return (
    <>
      {filteredVehicles.map((vehicle) => (
        <BusMarker key={vehicle.id} vehicle={vehicle} />
      ))}
    </>
  )
})

export default function MapView() {
  const resolvedTheme = useResolvedTheme()
  const tileUrl = getTileUrl(resolvedTheme)
  const attribution = getAttribution()

  return (
    <MapContainer
      center={NUUK_CENTER}
      zoom={DEFAULT_ZOOM}
      className="map-container"
      zoomControl={true}
    >
      <MapResizer />
      
      {/* Key forces TileLayer to remount on theme change */}
      <TileLayer
        key={resolvedTheme}
        attribution={attribution}
        url={tileUrl}
        subdomains={TILE_SUBDOMAINS}
        keepBuffer={4}
        updateWhenZooming={false}
        updateWhenIdle={true}
        maxZoom={TILE_MAX_ZOOM}
        tileSize={256}
        crossOrigin="anonymous"
      />

      {/* Static layers (behind feature flag) */}
      {ENABLE_STATIC_LAYERS && (
        <>
          <RoutesLayer />
          <StopsLayer />
        </>
      )}

      {/* Live vehicle markers */}
      <VehicleMarkers />
    </MapContainer>
  )
}
