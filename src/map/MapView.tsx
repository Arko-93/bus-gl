// src/map/MapView.tsx
// Main map component with Leaflet

import { useEffect, useMemo, memo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { filterVehiclesByRoute } from '../state/appStore'
import { useResolvedTheme } from '../hooks/useResolvedTheme'
import BusMarker from './BusMarker'
import StopsLayer from './StopsLayer'
import RoutesLayer from './RoutesLayer'
import type { Vehicle } from '../data/ridangoRealtime'

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
const ENABLE_ROUTES_LAYER = import.meta.env.VITE_ENABLE_ROUTES_LAYER === 'true'

// Mobile follow settings
const MOBILE_FOLLOW_OFFSET_RATIO = 0.18
const MOBILE_FOLLOW_ANIMATION_SEC = 0.45
const MOBILE_FOLLOW_EASE = 0.22

// Qatserisut depot - where buses are maintained/stored
const DEPOT_BOUNDS = {
  minLat: 64.1795,
  maxLat: 64.1825,
  minLon: -51.7200,
  maxLon: -51.7130,
}

function isAtDepot(vehicle: Vehicle): boolean {
  return (
    vehicle.lat >= DEPOT_BOUNDS.minLat &&
    vehicle.lat <= DEPOT_BOUNDS.maxLat &&
    vehicle.lon >= DEPOT_BOUNDS.minLon &&
    vehicle.lon <= DEPOT_BOUNDS.maxLon
  )
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
 * Keep the selected bus centered on mobile as it moves.
 */
function MobileFollowSelectedVehicle() {
  const map = useMap()
  const { data: vehicles = [] } = useVehiclesQuery()
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )
  const targetLat = selectedVehicle?.lat
  const targetLon = selectedVehicle?.lon

  useEffect(() => {
    if (!isMobile || targetLat == null || targetLon == null) return

    const zoom = map.getZoom()
    const size = map.getSize()
    const verticalOffset = Math.round(size.y * MOBILE_FOLLOW_OFFSET_RATIO)
    const busPoint = map.project([targetLat, targetLon], zoom)
    const targetCenter = map.unproject(busPoint.add([0, verticalOffset]), zoom)

    map.panTo(targetCenter, {
      animate: true,
      duration: MOBILE_FOLLOW_ANIMATION_SEC,
      easeLinearity: MOBILE_FOLLOW_EASE,
    })
  }, [map, isMobile, targetLat, targetLon])

  return null
}

/**
 * Render the selected bus above the mobile overlay.
 */
function MobileSelectedVehicleOverlayMarker() {
  const map = useMap()
  const { data: vehicles = [] } = useVehiclesQuery()
  const isMobile = useAppStore((state) => state.isMobile)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const lastVehicleRef = useRef<Vehicle | null>(null)
  const currentVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )

  if (currentVehicle) {
    lastVehicleRef.current = currentVehicle
  }

  const selectedVehicle = currentVehicle ?? (selectedVehicleId ? lastVehicleRef.current : null)
  const targetLat = selectedVehicle?.lat
  const targetLon = selectedVehicle?.lon

  useEffect(() => {
    if (!isMobile || !isBottomSheetOpen || targetLat == null || targetLon == null) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const container = map.getContainer()
      const rect = container.getBoundingClientRect()
      const point = map.latLngToContainerPoint([targetLat, targetLon])
      setPosition({
        left: rect.left + point.x,
        top: rect.top + point.y,
      })
    }

    updatePosition()
    map.on('move zoom resize', updatePosition)
    window.addEventListener('resize', updatePosition)

    return () => {
      map.off('move zoom resize', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [map, isMobile, isBottomSheetOpen, targetLat, targetLon])

  if (!isMobile || !isBottomSheetOpen || !position || !selectedVehicle) return null

  const atDepot = isAtDepot(selectedVehicle)
  const color = getRouteColor(selectedVehicle.route)
  const staleClass = selectedVehicle.isStale ? 'bus-marker--stale' : ''
  const depotClass = atDepot ? 'bus-marker--depot' : ''
  const x3Class = selectedVehicle.route === 'X3' ? 'bus-marker--x3' : ''

  return createPortal(
    <div
      className={`bus-marker selected-bus-overlay ${staleClass} ${depotClass}`}
      style={{ left: position.left, top: position.top }}
    >
      <div
        className={`bus-marker__inner ${x3Class} ${depotClass}`}
        style={{ backgroundColor: atDepot ? '#6b7280' : color }}
      >
        <span className="bus-marker__label">{selectedVehicle.route}</span>
        {selectedVehicle.isStale && <span className="bus-marker__stale-badge">!</span>}
        {atDepot && !selectedVehicle.isStale && (
          <span className="bus-marker__depot-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </span>
        )}
      </div>
    </div>,
    document.body
  )
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
      <MobileFollowSelectedVehicle />
      <MobileSelectedVehicleOverlayMarker />
      
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

      {/* Static route lines (behind feature flag) */}
      {ENABLE_ROUTES_LAYER && <RoutesLayer />}

      {/* Bus stops layer - always enabled */}
      <StopsLayer />

      {/* Live vehicle markers */}
      <VehicleMarkers />
    </MapContainer>
  )
}
