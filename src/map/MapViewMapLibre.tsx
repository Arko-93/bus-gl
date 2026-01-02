import { useEffect, useMemo, memo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import maplibregl from 'maplibre-gl'
import type * as MapLibreGL from 'maplibre-gl'
import { Map, MapControls, MapPopup, useMap } from '@/components/ui/map'
import { useAppStore, filterVehiclesByRoute } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useTranslation } from '../i18n/useTranslation'
import { getRouteColor, isAtDepot } from '../data/routeColors'
import type { Vehicle } from '../data/ridangoRealtime'
import BusMarkerMapLibre from './BusMarkerMapLibre'
import StopsLayerMapLibre from './StopsLayerMapLibre'
import RoutesLayerMapLibre from './RoutesLayerMapLibre'
import SelectedBusPathMapLibre from './SelectedBusPathMapLibre'
import SelectedRoutePathMapLibre from './SelectedRoutePathMapLibre'

const NUUK_CENTER: [number, number] = [64.1814, -51.6941]
const NUUK_CENTER_LNG_LAT: [number, number] = [NUUK_CENTER[1], NUUK_CENTER[0]]
const DEFAULT_ZOOM = 13
const NUUK_BOUNDS: [[number, number], [number, number]] = [
  [-51.78, 64.12],
  [-51.62, 64.23],
]

const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Maptiler configuration (vector tiles - higher quality)
const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || ''
// Use 'dataviz' for light mode - has muted water colors ideal for transit apps
// Alternative options: 'streets-v2', 'basic-v2', 'pastel'
const MAPTILER_LIGHT_STYLE = import.meta.env.VITE_MAPTILER_LIGHT_STYLE || 'dataviz'
const MAPTILER_DARK_STYLE = import.meta.env.VITE_MAPTILER_DARK_STYLE || 'dataviz-dark'

// Raster tile configuration (fallback)
const TILE_LIGHT_URL = import.meta.env.VITE_TILE_LIGHT_URL || CARTO_LIGHT_URL
const TILE_DARK_URL = import.meta.env.VITE_TILE_DARK_URL || CARTO_DARK_URL
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || CARTO_ATTRIBUTION
const TILE_SUBDOMAINS = import.meta.env.VITE_TILE_SUBDOMAINS || 'abcd'
const TILE_MAX_ZOOM = parseInt(import.meta.env.VITE_TILE_MAX_ZOOM || '19', 10)

const ENABLE_ROUTES_LAYER = import.meta.env.VITE_ENABLE_ROUTES_LAYER === 'true'

const MOBILE_FOLLOW_OFFSET_RATIO = 0.18
const MOBILE_FOLLOW_ANIMATION_MS = 320
const MOBILE_FOLLOW_EASE = 0.22
const MOBILE_FOLLOW_RESUME_MS = 500

function getTileUrl(theme: 'light' | 'dark'): string {
  const url = theme === 'dark' ? TILE_DARK_URL : TILE_LIGHT_URL
  if (!url || url === '') {
    return OSM_FALLBACK_URL
  }
  return url
}

function getAttribution(): string {
  if (!TILE_ATTRIBUTION || TILE_ATTRIBUTION === '') {
    return OSM_FALLBACK_ATTRIBUTION
  }
  return TILE_ATTRIBUTION
}

/**
 * Build Maptiler vector style URL
 * Supports both style names (e.g., 'streets-v2') and full URLs
 */
function getMaptilerStyleUrl(style: string): string {
  // If it's already a full URL, just append the API key
  if (style.startsWith('http://') || style.startsWith('https://')) {
    const separator = style.includes('?') ? '&' : '?'
    return `${style}${separator}key=${MAPTILER_API_KEY}`
  }
  // Otherwise, build the standard Maptiler style URL
  return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_API_KEY}`
}

/**
 * Check if Maptiler is configured and should be used
 */
function useMaptiler(): boolean {
  return MAPTILER_API_KEY.length > 0
}

type MapStyleOption = string | MapLibreGL.StyleSpecification

/**
 * Get the appropriate map styles based on configuration
 * Uses Maptiler vector tiles if API key is available, otherwise falls back to raster tiles
 */
function getMapStyles(): { light: MapStyleOption; dark: MapStyleOption } {
  if (useMaptiler()) {
    return {
      light: getMaptilerStyleUrl(MAPTILER_LIGHT_STYLE),
      dark: getMaptilerStyleUrl(MAPTILER_DARK_STYLE),
    }
  }
  // Fallback to raster tiles
  return {
    light: buildRasterStyle(getTileUrl('light'), getAttribution(), TILE_MAX_ZOOM, TILE_SUBDOMAINS),
    dark: buildRasterStyle(getTileUrl('dark'), getAttribution(), TILE_MAX_ZOOM, TILE_SUBDOMAINS),
  }
}

function normalizeSubdomains(subdomains: string): string[] {
  if (!subdomains) return []
  if (subdomains.includes(',')) {
    return subdomains.split(',').map((value) => value.trim()).filter(Boolean)
  }
  return subdomains.split('').filter(Boolean)
}

function isRetinaDisplay(): boolean {
  return typeof window !== 'undefined' && window.devicePixelRatio > 1
}

function expandTileUrls(url: string, subdomains: string): string[] {
  // Handle retina placeholder {r} - replace with @2x on retina displays, empty otherwise
  const retinaUrl = url.replace('{r}', isRetinaDisplay() ? '@2x' : '')
  
  if (!retinaUrl.includes('{s}')) return [retinaUrl]
  const tokens = normalizeSubdomains(subdomains)
  if (tokens.length === 0) return [retinaUrl.replace('{s}', 'a')]
  return tokens.map((token) => retinaUrl.replace('{s}', token))
}

function buildRasterStyle(url: string, attribution: string, maxZoom: number, subdomains: string): MapLibreGL.StyleSpecification {
  const tiles = expandTileUrls(url, subdomains)
  // Use 512 tile size for retina (@2x) tiles, 256 for standard
  const tileSize = url.includes('{r}') && isRetinaDisplay() ? 512 : 256
  return {
    version: 8,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles,
        tileSize,
        attribution,
        maxzoom: maxZoom,
      },
    },
    layers: [
      {
        id: 'raster-tiles',
        type: 'raster',
        source: 'raster-tiles',
      },
    ],
  }
}

function MapResizer() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const handleResize = () => {
      map.resize()
    }

    window.addEventListener('resize', handleResize)
    setTimeout(handleResize, 50)
    setTimeout(handleResize, 200)
    setTimeout(handleResize, 500)

    return () => window.removeEventListener('resize', handleResize)
  }, [map, isLoaded])

  return null
}

/**
 * Disables rotation on touch gestures while keeping pinch-to-zoom enabled.
 * MapLibre's touchZoomRotate handler combines both gestures, but provides
 * a disableRotation() method to allow zoom-only behavior.
 */
function TouchRotationDisabler() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    // Disable rotation component of touchZoomRotate, keeping zoom enabled
    map.touchZoomRotate.disableRotation()
  }, [map, isLoaded])

  return null
}

function MapBoundsLimiter() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const bounds = new maplibregl.LngLatBounds(NUUK_BOUNDS[0], NUUK_BOUNDS[1])

    const applyBounds = () => {
      const camera = map.cameraForBounds(bounds, { padding: 20 })
      if (camera?.zoom != null) {
        map.setMinZoom(Math.max(camera.zoom, 11))
      }
      if (!bounds.contains(map.getCenter())) {
        map.setCenter(NUUK_CENTER_LNG_LAT)
        map.setZoom(DEFAULT_ZOOM)
      }
    }

    const timeout = setTimeout(applyBounds, 150)
    map.on('resize', applyBounds)

    return () => {
      clearTimeout(timeout)
      map.off('resize', applyBounds)
    }
  }, [map, isLoaded])

  return null
}

function MapClickHandler() {
  const { map, isLoaded } = useMap()
  const setSelectedStopId = useAppStore((state) => state.setSelectedStopId)

  useEffect(() => {
    if (!map || !isLoaded) return

    const handleClick = () => {
      const state = useAppStore.getState()
      if (state.selectedStopId !== null) {
        setSelectedStopId(null, { openPanel: false })
      }
    }

    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, isLoaded, setSelectedStopId])

  return null
}

function MobileFollowSelectedVehicle() {
  const { map, isLoaded } = useMap()
  const { data: vehicles = [] } = useVehiclesQuery()
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const setBottomSheetOpen = useAppStore((state) => state.setBottomSheetOpen)

  const isUserInteractingRef = useRef(false)
  const resumeTimeoutRef = useRef<number | null>(null)
  const lastSelectedIdRef = useRef<string | null>(null)
  const userZoomRef = useRef<number | null>(null)

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )
  const targetLat = selectedVehicle?.lat
  const targetLon = selectedVehicle?.lon

  useEffect(() => {
    if (!isMobile || !map || !isLoaded) return

    const pauseFollow = () => {
      isUserInteractingRef.current = true
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
      }
    }

    const resumeFollow = () => {
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
      }
      resumeTimeoutRef.current = window.setTimeout(() => {
        isUserInteractingRef.current = false
      }, MOBILE_FOLLOW_RESUME_MS)
    }

    const handleZoomStart = () => {
      pauseFollow()
    }

    const handleZoomEnd = () => {
      userZoomRef.current = map.getZoom()
      resumeFollow()
    }

    const handleDragStart = () => {
      pauseFollow()
    }

    const handleDragEnd = () => {
      resumeFollow()
    }

    map.on('zoomstart', handleZoomStart)
    map.on('zoomend', handleZoomEnd)
    map.on('dragstart', handleDragStart)
    map.on('dragend', handleDragEnd)

    return () => {
      map.off('zoomstart', handleZoomStart)
      map.off('zoomend', handleZoomEnd)
      map.off('dragstart', handleDragStart)
      map.off('dragend', handleDragEnd)
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
        resumeTimeoutRef.current = null
      }
    }
  }, [map, isMobile, isLoaded])

  useEffect(() => {
    userZoomRef.current = null
  }, [selectedVehicleId])

  useEffect(() => {
    if (!isMobile || !map || !isLoaded) return
    if (!selectedVehicleId) {
      lastSelectedIdRef.current = null
      return
    }
    if (!selectedVehicle) return
    if (lastSelectedIdRef.current === selectedVehicleId) return

    lastSelectedIdRef.current = selectedVehicleId
    isUserInteractingRef.current = false
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }

    const zoom = userZoomRef.current ?? map.getZoom()
    const size = map.getContainer().getBoundingClientRect()
    const verticalOffset = Math.round(size.height * MOBILE_FOLLOW_OFFSET_RATIO)
    const busPoint = map.project([selectedVehicle.lon, selectedVehicle.lat])
    const targetCenter = map.unproject([busPoint.x, busPoint.y + verticalOffset])

    const openSheet = () => {
      if (!isBottomSheetOpen) {
        setBottomSheetOpen(true)
      }
    }

    const distance = map.getCenter().distanceTo(new maplibregl.LngLat(targetCenter.lng, targetCenter.lat))
    if (distance < 20) {
      openSheet()
    } else {
      map.once('moveend', openSheet)
    }

    map.easeTo({
      center: [targetCenter.lng, targetCenter.lat],
      zoom,
      duration: MOBILE_FOLLOW_ANIMATION_MS,
      easing: (t) => t * (2 - t) * MOBILE_FOLLOW_EASE + t * (1 - MOBILE_FOLLOW_EASE),
    })

    return () => {
      map.off('moveend', openSheet)
    }
  }, [
    map,
    isLoaded,
    isMobile,
    selectedVehicleId,
    selectedVehicle,
    isBottomSheetOpen,
    setBottomSheetOpen,
  ])

  useEffect(() => {
    if (!isMobile || !map || !isLoaded || targetLat == null || targetLon == null) return
    if (isUserInteractingRef.current) return

    const zoom = userZoomRef.current ?? map.getZoom()
    const size = map.getContainer().getBoundingClientRect()
    const verticalOffset = Math.round(size.height * MOBILE_FOLLOW_OFFSET_RATIO)
    const busPoint = map.project([targetLon, targetLat])
    const targetCenter = map.unproject([busPoint.x, busPoint.y + verticalOffset])

    map.easeTo({
      center: [targetCenter.lng, targetCenter.lat],
      zoom,
      duration: MOBILE_FOLLOW_ANIMATION_MS,
      easing: (t) => t * (2 - t) * MOBILE_FOLLOW_EASE + t * (1 - MOBILE_FOLLOW_EASE),
    })
  }, [map, isLoaded, isMobile, targetLat, targetLon])

  return null
}

function MobileSelectedVehicleOverlayMarker() {
  const { map, isLoaded } = useMap()
  const { data: vehicles = [] } = useVehiclesQuery()
  const isMobile = useAppStore((state) => state.isMobile)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )
  const targetLat = selectedVehicle?.lat
  const targetLon = selectedVehicle?.lon

  useEffect(() => {
    if (!isMobile || !isBottomSheetOpen || !map || !isLoaded || targetLat == null || targetLon == null) {
      return
    }

    const updatePosition = () => {
      const rect = map.getContainer().getBoundingClientRect()
      const point = map.project([targetLon, targetLat])
      setPosition({
        left: rect.left + point.x,
        top: rect.top + point.y,
      })
    }

    const scheduleUpdate = () => {
      requestAnimationFrame(updatePosition)
    }

    scheduleUpdate()
    map.on('move', scheduleUpdate)
    map.on('zoom', scheduleUpdate)
    map.on('resize', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      map.off('move', scheduleUpdate)
      map.off('zoom', scheduleUpdate)
      map.off('resize', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [map, isLoaded, isMobile, isBottomSheetOpen, targetLat, targetLon])

  if (!isMobile || !isBottomSheetOpen || !position || !selectedVehicle) return null

  const atDepot = isAtDepot(selectedVehicle.lat, selectedVehicle.lon)
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

const VehicleMarkers = memo(function VehicleMarkers() {
  const { map, isLoaded } = useMap()
  const { data: vehicles = [], isLoading } = useVehiclesQuery()
  const enabledRoutes = useAppStore((state) => state.enabledRoutes)
  const hasFittedBounds = useRef(false)

  const filteredVehicles = useMemo(
    () => filterVehiclesByRoute(vehicles, enabledRoutes),
    [vehicles, enabledRoutes]
  )

  useEffect(() => {
    if (!map || !isLoaded) return
    if (!hasFittedBounds.current && filteredVehicles.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      filteredVehicles.forEach((v) => bounds.extend([v.lon, v.lat]))
      map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 })
      hasFittedBounds.current = true
    }
  }, [filteredVehicles, map, isLoaded])

  if (isLoading && filteredVehicles.length === 0) {
    return null
  }

  return (
    <>
      {filteredVehicles.map((vehicle) => (
        <BusMarkerMapLibre key={vehicle.id} vehicle={vehicle} />
      ))}
    </>
  )
})

function formatTime(ms: number, locale: string): string {
  if (ms === 0) return ''
  const date = new Date(ms)
  const localeMap: Record<string, string> = { kl: 'da-DK', da: 'da-DK', en: 'en-GB' }
  return date.toLocaleTimeString(localeMap[locale] || 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(/[.]/g, ':')
}

function BusPopupContent({ vehicle, locale }: { vehicle: Vehicle; locale: string }) {
  const t = useTranslation()
  const getTimeAgo = useCallback((ms: number): string => {
    if (ms === 0) return ''
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return `${seconds}${t.secondsAgo}`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${t.minutesAgo}`
    return `${Math.floor(minutes / 60)}${t.hoursAgo}`
  }, [t.hoursAgo, t.minutesAgo, t.secondsAgo])

  const atDepot = isAtDepot(vehicle.lat, vehicle.lon)
  const alertIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
  const gearIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )

  return (
    <div className="bus-popup">
      <h3 className="bus-popup__route" style={{ color: getRouteColor(vehicle.route) }}>
        {t.route} {vehicle.route}
      </h3>
      <div className="bus-popup__details">
        <div className="bus-popup__section">
          {!vehicle.atStop && (
            <div className="bus-popup__row">
              <span className="bus-popup__label">{t.currentStop}:</span>
              <span>{vehicle.stopName || t.inTransit}</span>
            </div>
          )}
          {vehicle.nextStopName && (
            <div className="bus-popup__row">
              <span className="bus-popup__label">{t.nextStop}:</span>
              <span>{vehicle.nextStopName}</span>
            </div>
          )}
        </div>
        {vehicle.atStop && (
          <div className="bus-popup__at-stop">
            {t.atStop}: {vehicle.stopName || t.unknown}
          </div>
        )}
        {atDepot && (
          <div className="bus-popup__at-depot">
            <span>{gearIcon}</span> {t.atDepot}
          </div>
        )}
        {vehicle.isStale && (
          <div className="bus-popup__stale-warning">
            <span>{alertIcon}</span> {t.dataOutdated}
          </div>
        )}
        <div className="bus-popup__log">
          <div className="bus-popup__row">
            <span className="bus-popup__label">{t.speed}:</span>
            <span>{vehicle.speed} {t.kmh}</span>
          </div>
          <div className="bus-popup__row">
            <span className="bus-popup__label">{t.updated}:</span>
            <span>
              {formatTime(vehicle.updatedAtMs, locale)}
              <span className="bus-popup__time-ago"> ({getTimeAgo(vehicle.updatedAtMs)})</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SelectedVehiclePopup() {
  const { data: vehicles = [] } = useVehiclesQuery()
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)
  const isMobile = useAppStore((state) => state.isMobile)
  const locale = useAppStore((state) => state.locale)

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )

  if (isMobile || !selectedVehicle) return null

  return (
    <MapPopup
      longitude={selectedVehicle.lon}
      latitude={selectedVehicle.lat}
      closeButton={true}
      closeOnClick={false}
      onClose={() => setSelectedVehicleId(null, { openPanel: false })}
    >
      <BusPopupContent vehicle={selectedVehicle} locale={locale} />
    </MapPopup>
  )
}

function ResponsiveMapControls() {
  return (
    <MapControls
      position="top-right"
      showZoom={true}
      className="map-controls--below-top-bar"
    />
  )
}

export default function MapViewMapLibre() {
  const mapStyles = useMemo(() => getMapStyles(), [])

  return (
    <div className="map-container">
      <Map
        center={NUUK_CENTER_LNG_LAT}
        zoom={DEFAULT_ZOOM}
        maxBounds={NUUK_BOUNDS}
        styles={mapStyles}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
      >
        <MapResizer />
        <MapBoundsLimiter />
        <TouchRotationDisabler />
        <MapClickHandler />
        <MobileFollowSelectedVehicle />
        <MobileSelectedVehicleOverlayMarker />
        <ResponsiveMapControls />

        {ENABLE_ROUTES_LAYER && <RoutesLayerMapLibre />}
        <SelectedRoutePathMapLibre />
        <SelectedBusPathMapLibre />
        <StopsLayerMapLibre />
        <VehicleMarkers />
        <SelectedVehiclePopup />
      </Map>
    </div>
  )
}
