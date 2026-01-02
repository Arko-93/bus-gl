import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bus, ArrowRight, Timer } from 'lucide-react'
import { MapMarker, MarkerContent, MarkerTooltip, MapPopup, useMap } from '@/components/ui/map'
import { useStopsData, type StopFeature } from '../data/useStopsData'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useRoute1Schedule, getUpcomingTimes } from '../data/route1Schedule'
import { useRoute2Schedule } from '../data/route2Schedule'
import { useRoute3Schedule } from '../data/route3Schedule'
import { useRouteX2Schedule } from '../data/routeX2Schedule'
import { useRouteE2Schedule } from '../data/routeE2Schedule'
import { useRouteX3Schedule } from '../data/routeX3Schedule'
import { useTranslation } from '../i18n/useTranslation'
import { getRouteColor } from '../data/routeColors'
import { type KnownRoute } from '../data/ridangoRealtime'

/**
 * Display coordinate overrides for bus stops.
 * These move the stop circle marker to the actual bus stop location
 * (e.g., on sidewalk/shelter) rather than the road centerline.
 * Format: stopId -> [latitude, longitude]
 * 
 * Note: This only affects stop circle display, NOT route path rendering.
 * Route paths use ROUTE_STOP_COORD_OVERRIDES in SelectedRoutePathMapLibre.tsx
 */
const STOP_COORD_DISPLAY_OVERRIDES: Record<number, [number, number]> = {
  // Add overrides as needed after visual inspection
  // Example: 63: [64.1840093, -51.6980487], // Maligiaq - moved off road
}

/**
 * Get display coordinates for a stop, applying overrides if available
 */
function getStopDisplayCoords(stopId: number, originalLon: number, originalLat: number): [number, number] {
  const override = STOP_COORD_DISPLAY_OVERRIDES[stopId]
  if (override) {
    // Override format is [lat, lon], return as [lon, lat] for MapLibre
    return [override[1], override[0]]
  }
  return [originalLon, originalLat]
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent))
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent))
  const b = Math.max(0, (num & 0xff) * (1 - percent))
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const num = parseInt(normalized, 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getStopStyle(
  isCurrentStop: boolean,
  isNextStop: boolean,
  isSelected: boolean,
  matchMethod: StopFeature['properties']['matchMethod'],
  routeColor?: string
) {
  const base = {
    radius: 6,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.7,
  }

  if (isSelected) {
    return {
      ...base,
      radius: 9,
      fillColor: '#60a5fa',
      color: '#3b82f6',
      weight: 2,
      fillOpacity: 0.95,
    }
  }

  if (isCurrentStop && routeColor) {
    return {
      ...base,
      radius: 6,
      fillColor: routeColor,
      color: darkenColor(routeColor, 0.25),
      weight: 2,
      fillOpacity: 0.7,
      dashArray: '4, 4',
    }
  }

  if (isNextStop && routeColor) {
    return {
      ...base,
      radius: 6,
      fillColor: routeColor,
      color: darkenColor(routeColor, 0.25),
      weight: 2,
      fillOpacity: 0.35,
      opacity: 0.6,
    }
  }

  if (isCurrentStop) {
    return {
      ...base,
      radius: 6,
      fillColor: '#6366f1',
      color: '#4f46e5',
      weight: 2,
      fillOpacity: 0.7,
      dashArray: '4, 4',
    }
  }

  if (isNextStop) {
    return {
      ...base,
      radius: 6,
      fillColor: '#6366f1',
      color: '#4f46e5',
      weight: 2,
      fillOpacity: 0.35,
      opacity: 0.6,
    }
  }

  if (matchMethod === 'unmatched') {
    return {
      ...base,
      fillColor: '#ef4444',
      color: '#dc2626',
    }
  }

  if (matchMethod === 'fuzzy') {
    return {
      ...base,
      fillColor: '#8b5cf6',
      color: '#7c3aed',
    }
  }

  return {
    ...base,
    fillColor: '#6366f1',
    color: '#4f46e5',
  }
}

const MOBILE_FOLLOW_OFFSET_RATIO = 0.18
const MOBILE_FOLLOW_ANIMATION_MS = 400

interface StopMarkerProps {
  id: number
  name: string
  lat: number
  lon: number
  style: ReturnType<typeof getStopStyle>
  isCurrentStop: boolean
  isNextStop: boolean
  isVehicleStop: boolean
  isSelected: boolean
  atStopCount: number
  arrivingCount: number
  scheduleInfo: ReturnType<typeof getUpcomingTimes>
  scheduleLabel: string | null
  isX3Schedule: boolean
  isMobile: boolean
  setSelectedStopId: (id: number | null, options?: { openPanel?: boolean }) => void
  t: ReturnType<typeof useTranslation>
}

function StopMarker({
  id,
  name,
  lat,
  lon,
  style,
  isVehicleStop,
  isSelected,
  isMobile,
  setSelectedStopId,
}: StopMarkerProps) {
  const handleClick = useCallback((event: MouseEvent) => {
    event.stopPropagation()
    if (isVehicleStop) return

    if (isMobile) {
      // On mobile, single click opens the bottom sheet directly
      if (isSelected) {
        setSelectedStopId(null, { openPanel: false })
      } else {
        setSelectedStopId(id, { openPanel: true })
      }
    } else {
      // On desktop, click selects the stop (shows popup on map)
      setSelectedStopId(id, { openPanel: false })
    }
  }, [id, isMobile, isSelected, isVehicleStop, setSelectedStopId])

  const hasDash = 'dashArray' in style && Boolean(style.dashArray)
  const markerStyle: React.CSSProperties = {
    width: `${style.radius * 2}px`,
    height: `${style.radius * 2}px`,
    borderRadius: '999px',
    backgroundColor: style.fillOpacity < 1 ? hexToRgba(style.fillColor, style.fillOpacity) : style.fillColor,
    border: `${style.weight}px ${hasDash ? 'dashed' : 'solid'} ${style.color}`,
    opacity: style.opacity ?? 1,
  }

  return (
    <MapMarker longitude={lon} latitude={lat} onClick={handleClick}>
      <MarkerContent>
        <div style={markerStyle} />
      </MarkerContent>
      {/* Only show tooltip on desktop - on mobile, clicks go directly to the bottom sheet */}
      {!isMobile && (
        <MarkerTooltip>
          <div>
            <strong>{name}</strong>
          </div>
        </MarkerTooltip>
      )}
    </MapMarker>
  )
}

function MobileFollowSelectedStop() {
  const { map, isLoaded } = useMap()
  const { data: stopsData } = useStopsData()
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedStopId = useAppStore((state) => state.selectedStopId)

  const selectedStop = useMemo(() => {
    if (!selectedStopId || !stopsData) return null
    return stopsData.features.find((f) => f.properties.id === selectedStopId) ?? null
  }, [stopsData, selectedStopId])

  const coords = selectedStop?.geometry.coordinates
  const targetLon = coords?.[0]
  const targetLat = coords?.[1]

  useEffect(() => {
    if (!isMobile || !isLoaded || !map || targetLat == null || targetLon == null) return

    const size = map.getContainer().getBoundingClientRect()
    const verticalOffset = Math.round(size.height * MOBILE_FOLLOW_OFFSET_RATIO)
    const stopPoint = map.project([targetLon, targetLat])
    const targetCenter = map.unproject([stopPoint.x, stopPoint.y + verticalOffset])

    map.easeTo({
      center: [targetCenter.lng, targetCenter.lat],
      duration: MOBILE_FOLLOW_ANIMATION_MS,
    })
  }, [map, isLoaded, isMobile, targetLat, targetLon, selectedStopId])

  return null
}

function SelectedStopOverlay() {
  const { map, isLoaded } = useMap()
  const { data: stopsData } = useStopsData()
  const isMobile = useAppStore((state) => state.isMobile)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const selectedStopId = useAppStore((state) => state.selectedStopId)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const selectedStop = useMemo(() => {
    if (!selectedStopId || !stopsData) return null
    return stopsData.features.find((f) => f.properties.id === selectedStopId) ?? null
  }, [stopsData, selectedStopId])

  const coords = selectedStop?.geometry.coordinates
  const targetLon = coords?.[0]
  const targetLat = coords?.[1]

  const shouldRender = isMobile ? isBottomSheetOpen : true

  useEffect(() => {
    if (!shouldRender || !isLoaded || !map || targetLat == null || targetLon == null) {
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
  }, [map, isLoaded, shouldRender, targetLat, targetLon])

  if (!shouldRender || !position || !selectedStop) return null

  return createPortal(
    <div className="selected-stop-overlay" style={{ left: position.left, top: position.top }}>
      <div className="selected-stop-overlay__circle" />
    </div>,
    document.body
  )
}

interface DesktopStopPopupProps {
  stop: StopFeature
  scheduleCandidates: Array<{ route: string; schedule: ReturnType<typeof useRoute1Schedule>['data'] }>
  selectedStopRoute: KnownRoute | null
  isCurrentStop: boolean
  isNextStop: boolean
  atStopCount: number
  arrivingCount: number
  onClose: () => void
  t: ReturnType<typeof useTranslation>
}

function DesktopStopPopup({
  stop,
  scheduleCandidates,
  selectedStopRoute,
  isCurrentStop,
  isNextStop,
  atStopCount,
  arrivingCount,
  onClose,
  t,
}: DesktopStopPopupProps) {
  const setSelectedStopRoute = useAppStore((state) => state.setSelectedStopRoute)

  // Determine which routes serve this stop
  const routesServingStop = useMemo(() => {
    const routes: KnownRoute[] = []
    for (const candidate of scheduleCandidates) {
      if (candidate.schedule) {
        const stopIdStr = String(stop.properties.id)
        if (candidate.schedule.weekdays[stopIdStr] || candidate.schedule.weekends[stopIdStr]) {
          routes.push(candidate.route as KnownRoute)
        }
      }
    }
    return routes
  }, [scheduleCandidates, stop.properties.id])

  // Determine the active route for schedule display
  const activeRoute = selectedStopRoute ?? (routesServingStop[0] || null)

  // Sort routes so active route comes first
  const sortedRoutes = useMemo(() => {
    if (!activeRoute) return routesServingStop
    return [
      ...routesServingStop.filter((r) => r === activeRoute),
      ...routesServingStop.filter((r) => r !== activeRoute),
    ]
  }, [routesServingStop, activeRoute])

  // Get schedule for active route
  const resolvedSchedule = scheduleCandidates.find(
    (candidate) => candidate.route === activeRoute && candidate.schedule
  ) || null

  const scheduleInfo = resolvedSchedule
    ? getUpcomingTimes(resolvedSchedule.schedule, stop.properties.id, new Date(), 6)
    : null

  const scheduleLabel =
    scheduleInfo && resolvedSchedule
      ? `${t.route} ${resolvedSchedule.route} · ${
          scheduleInfo.service === 'weekdays' ? t.scheduleWeekdays : t.scheduleWeekends
        }`
      : null

  // Get the color for schedule times based on active route
  const scheduleRouteColor = activeRoute ? getRouteColor(activeRoute) : null
  const isX3Schedule = resolvedSchedule?.route === 'X3'

  // Handle clicking a route badge
  const handleRouteBadgeClick = useCallback((route: KnownRoute) => {
    setSelectedStopRoute(route)
  }, [setSelectedStopRoute])

  return (
    <MapPopup
      longitude={stop.geometry.coordinates![0]}
      latitude={stop.geometry.coordinates![1]}
      closeButton={true}
      onClose={onClose}
    >
      <div className="stop-popup">
        <strong>{stop.properties.name}</strong>
        
        {/* Route badges header */}
        <div className="stop-popup__route-badges">
          {sortedRoutes.length > 0 ? (
            sortedRoutes.map((route) => {
              const isActive = route === activeRoute
              return (
                <button
                  key={route}
                  className={`stop-popup__route-badge ${isActive ? 'stop-popup__route-badge--active' : ''} ${route === 'X3' ? 'stop-popup__route-badge--x3' : ''}`}
                  style={{ backgroundColor: getRouteColor(route) }}
                  onClick={() => handleRouteBadgeClick(route)}
                  title={`${t.route} ${route}`}
                >
                  {route}
                </button>
              )
            })
          ) : (
            <span className="stop-popup__route-badge" style={{ backgroundColor: '#6b7280' }}>
              ?
            </span>
          )}
        </div>

        {isCurrentStop && (
          <div>
            <Bus size={12} /> {t.busHere}
          </div>
        )}
        {isNextStop && (
          <div>
            <ArrowRight size={12} /> {t.nextStop}
          </div>
        )}
        {!isCurrentStop && !isNextStop && atStopCount > 0 && (
          <div>
            <Bus size={12} /> {atStopCount} {atStopCount === 1 ? t.bus : t.buses}
          </div>
        )}
        {!isNextStop && arrivingCount > 0 && (
          <div>
            <Timer size={12} /> {arrivingCount} {t.arriving}
          </div>
        )}
        {scheduleInfo && scheduleLabel && (
          <div className="stop-popup__schedule">
            <div className="stop-popup__schedule-title">
              {scheduleInfo.serviceEnded && <em>{t.serviceEnded} · </em>}
              {scheduleLabel}
            </div>
            <div className={`stop-schedule${isX3Schedule ? ' stop-schedule--x3' : ''}`}>
              {scheduleInfo.times.map((time) => (
                <span
                  key={`popup-${stop.properties.id}-${time.raw}`}
                  className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}${scheduleInfo.serviceEnded ? ' stop-schedule__time--ended' : ''}`}
                  style={time.isNext && scheduleRouteColor ? { backgroundColor: scheduleRouteColor, borderColor: scheduleRouteColor } : undefined}
                >
                  {time.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </MapPopup>
  )
}

export default function StopsLayerMapLibre() {
  const t = useTranslation()
  const { data: stopsData, isLoading, error } = useStopsData()
  const { data: vehicles = [] } = useVehiclesQuery()
  const { data: route1Schedule } = useRoute1Schedule()
  const { data: route2Schedule } = useRoute2Schedule()
  const { data: route3Schedule } = useRoute3Schedule()
  const { data: routeX2Schedule } = useRouteX2Schedule()
  const { data: routeE2Schedule } = useRouteE2Schedule()
  const { data: routeX3Schedule } = useRouteX3Schedule()

  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const selectedStopId = useAppStore((state) => state.selectedStopId)
  const setSelectedStopId = useAppStore((state) => state.setSelectedStopId)
  const filteredStopIds = useAppStore((state) => state.filteredStopIds)
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedStopRoute = useAppStore((state) => state.selectedStopRoute)

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId)

  const currentStopId = selectedVehicle?.stopId ?? null
  const nextStopId = selectedVehicle?.nextStopId ?? null
  const selectedVehicleRoute = selectedVehicle?.route ?? null
  const vehicleRouteColor = selectedVehicleRoute ? getRouteColor(selectedVehicleRoute) : undefined

  if (isLoading || error || !stopsData) {
    if (error) {
      console.warn('Failed to load stops layer:', error)
    }
    return null
  }

  const validStops = stopsData.features.filter((f) => f.geometry.coordinates !== null)

  const vehicleStopIds = new Set<number>()
  if (selectedVehicle && currentStopId != null) vehicleStopIds.add(currentStopId)
  if (selectedVehicle && nextStopId != null) vehicleStopIds.add(nextStopId)

  const visibleStops = validStops.filter((f) => {
    const id = f.properties.id
    if (vehicleStopIds.has(id)) return true
    if (filteredStopIds.size > 0 && filteredStopIds.has(id)) return true
    return false
  })

  const now = new Date()

  const arrivingCounts = new Map<number, number>()
  const atStopCounts = new Map<number, number>()
  for (const vehicle of vehicles) {
    if (vehicle.nextStopId != null) {
      arrivingCounts.set(
        vehicle.nextStopId,
        (arrivingCounts.get(vehicle.nextStopId) ?? 0) + 1
      )
    }
    if (vehicle.stopId != null) {
      atStopCounts.set(vehicle.stopId, (atStopCounts.get(vehicle.stopId) ?? 0) + 1)
    }
  }

  const scheduleCandidates = [
    { route: '1', schedule: route1Schedule },
    { route: '2', schedule: route2Schedule },
    { route: '3', schedule: route3Schedule },
    { route: 'X2', schedule: routeX2Schedule },
    { route: 'E2', schedule: routeE2Schedule },
    { route: 'X3', schedule: routeX3Schedule },
  ]

  const selectedStop = selectedStopId
    ? validStops.find((f) => f.properties.id === selectedStopId) ?? null
    : null

  const selectedStopArriving = selectedStop
    ? (arrivingCounts.get(selectedStop.properties.id) ?? 0)
    : 0
  const selectedStopAtStop = selectedStop
    ? (atStopCounts.get(selectedStop.properties.id) ?? 0)
    : 0
  const selectedIsCurrentStop = selectedStop?.properties.id === currentStopId
  const selectedIsNextStop = selectedStop?.properties.id === nextStopId

  return (
    <>
      {visibleStops.map((feature) => {
        const { id, name, matchMethod } = feature.properties
        const [originalLon, originalLat] = feature.geometry.coordinates!
        const [lon, lat] = getStopDisplayCoords(id, originalLon, originalLat)

        const isCurrentStop = id === currentStopId
        const isNextStop = id === nextStopId
        const isVehicleRelatedStop = isCurrentStop || isNextStop
        const isSelected = id === selectedStopId
        const style = getStopStyle(isCurrentStop, isNextStop, isSelected, matchMethod, vehicleRouteColor)

        const arrivingCount = arrivingCounts.get(id) ?? 0
        const atStopCount = atStopCounts.get(id) ?? 0

        const preferredRoute = isVehicleRelatedStop && selectedVehicleRoute
          ? selectedVehicleRoute
          : selectedStopRoute

        const resolvedSchedule =
          scheduleCandidates.find(
            (candidate) => candidate.route === preferredRoute && candidate.schedule
          ) ||
          scheduleCandidates.find(
            (candidate) =>
              candidate.schedule &&
              (candidate.schedule.weekdays[String(id)] || candidate.schedule.weekends[String(id)])
          ) ||
          null

        const scheduleInfo = resolvedSchedule
          ? getUpcomingTimes(resolvedSchedule.schedule, id, now, 6)
          : null

        const scheduleLabel =
          scheduleInfo && resolvedSchedule
            ? `${t.route} ${resolvedSchedule.route} · ${
                scheduleInfo.service === 'weekdays' ? t.scheduleWeekdays : t.scheduleWeekends
              }`
            : null

        const isX3Schedule = resolvedSchedule?.route === 'X3'

        return (
          <StopMarker
            key={id}
            id={id}
            name={name}
            lat={lat}
            lon={lon}
            style={style}
            isCurrentStop={isCurrentStop}
            isNextStop={isNextStop}
            isVehicleStop={isVehicleRelatedStop}
            isSelected={isSelected}
            atStopCount={atStopCount}
            arrivingCount={arrivingCount}
            scheduleInfo={scheduleInfo}
            scheduleLabel={scheduleLabel}
            isX3Schedule={isX3Schedule}
            isMobile={isMobile}
            setSelectedStopId={setSelectedStopId}
            t={t}
          />
        )
      })}
      {selectedStop && !isMobile && selectedStop.geometry.coordinates && (
        <DesktopStopPopup
          stop={selectedStop}
          scheduleCandidates={scheduleCandidates}
          selectedStopRoute={selectedStopRoute}
          isCurrentStop={selectedIsCurrentStop}
          isNextStop={selectedIsNextStop}
          atStopCount={selectedStopAtStop}
          arrivingCount={selectedStopArriving}
          onClose={() => setSelectedStopId(null, { openPanel: false })}
          t={t}
        />
      )}
      <MobileFollowSelectedStop />
      <SelectedStopOverlay />
    </>
  )
}
