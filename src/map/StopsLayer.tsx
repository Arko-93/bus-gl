// src/map/StopsLayer.tsx
// Layer for bus stops with highlighting for selected vehicle's stops

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Bus, ArrowRight, Timer } from 'lucide-react'
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

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent))
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent))
  const b = Math.max(0, (num & 0xff) * (1 - percent))
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

/**
 * Get stop marker style based on highlight state
 */
function getStopStyle(
  isCurrentStop: boolean,
  isNextStop: boolean,
  isSelected: boolean,
  matchMethod: StopFeature['properties']['matchMethod'],
  routeColor?: string
) {
  // Base style
  const base = {
    radius: 6,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.7,
  }

  // Selected stop
  if (isSelected) {
    return {
      ...base,
      radius: 9,
      fillColor: '#60a5fa', // Brighter blue for selected
      color: '#3b82f6',
      weight: 2,
      fillOpacity: 0.95,
    }
  }

  // Highlighted stops (current or next) - use route color
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

  // Fallback for current/next when no route color (shouldn't happen but safe)
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

  // Unmatched stops (no coordinates from OSM)
  if (matchMethod === 'unmatched') {
    return {
      ...base,
      fillColor: '#ef4444',
      color: '#dc2626',
    }
  }

  // Fuzzy matched stops
  if (matchMethod === 'fuzzy') {
    return {
      ...base,
      fillColor: '#8b5cf6',
      color: '#7c3aed',
    }
  }

  // Default: exact or manual match
  return {
    ...base,
    fillColor: '#6366f1',
    color: '#4f46e5',
  }
}

// Constants for mobile follow behavior (matching MapView.tsx)
const MOBILE_FOLLOW_OFFSET_RATIO = 0.18
const MOBILE_FOLLOW_ANIMATION_SEC = 0.4
const MOBILE_FOLLOW_EASE = 0.5

/**
 * Individual stop marker with popup that opens on click
 * For vehicle stops (current/next), shows timetable on hover instead of click
 */
interface StopMarkerProps {
  id: number
  name: string
  lat: number
  lon: number
  style: ReturnType<typeof getStopStyle>
  isCurrentStop: boolean
  isNextStop: boolean
  isVehicleStop: boolean // true if this stop belongs to a selected vehicle
  isSelected: boolean
  atStopCount: number
  arrivingCount: number
  scheduleInfo: ReturnType<typeof getUpcomingTimes>
  scheduleLabel: string | null
  isMobile: boolean
  selectedStopId: number | null
  setSelectedStopId: (id: number | null, options?: { openPanel?: boolean }) => void
  t: ReturnType<typeof useTranslation>
}

function StopMarker({
  id,
  name,
  lat,
  lon,
  style,
  isCurrentStop,
  isNextStop,
  isVehicleStop,
  isSelected,
  atStopCount,
  arrivingCount,
  scheduleInfo,
  scheduleLabel,
  isMobile,
  selectedStopId,
  setSelectedStopId,
  t,
}: StopMarkerProps) {
  const markerRef = useRef<L.CircleMarker>(null)

  const handlePopupOpen = useCallback(() => {
    // Set selected when popup opens (desktop) - only for non-vehicle stops
    if (!isMobile && !isVehicleStop) {
      setSelectedStopId(id, { openPanel: false })
    }
  }, [id, isMobile, isVehicleStop, setSelectedStopId])

  const handlePopupClose = useCallback(() => {
    // Don't clear selectedStopId here - let the click handler manage it
    // This prevents race conditions when clicking between stops
    // The state will be cleared when clicking elsewhere on the map
  }, [])

  const handleClick = useCallback((e: L.LeafletMouseEvent) => {
    // For vehicle stops (current/next stop of selected bus), don't handle clicks
    // This preserves the bus selection and route visibility
    if (isVehicleStop) {
      L.DomEvent.stopPropagation(e.originalEvent)
      return
    }

    // Stop propagation to prevent bus popup from closing
    L.DomEvent.stopPropagation(e.originalEvent)
    
    // On mobile - toggle selection for bottom sheet
    if (isMobile) {
      if (isSelected) {
        setSelectedStopId(null, { openPanel: true })
      } else {
        setSelectedStopId(id)
      }
    } else {
      // On desktop - set selected FIRST, then open popup
      // This ensures the stop is selected before the bus popup close handler runs
      setSelectedStopId(id, { openPanel: false })
      markerRef.current?.openPopup()
    }
  }, [id, isSelected, isMobile, isVehicleStop, setSelectedStopId])

  // Ensure stop circles appear above route paths
  const markerStyle = {
    ...style,
    pane: 'markerPane', // Force to marker pane (above overlays)
  }

  return (
    <CircleMarker
      ref={markerRef}
      center={[lat, lon]}
      {...markerStyle}
      eventHandlers={{
        click: handleClick,
        popupopen: handlePopupOpen,
        popupclose: handlePopupClose,
      }}
    >
      <Tooltip direction="top" offset={[0, -8]} sticky={isVehicleStop}>
        <div className={isVehicleStop ? 'stop-tooltip--vehicle' : ''}>
          <strong>{name}</strong>
          {isCurrentStop && <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} /> {t.busHere}</div>}
          {isNextStop && <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<ArrowRight size={12} />) }} /> {t.nextStop}</div>}
          {!isCurrentStop && !isNextStop && atStopCount > 0 && (
            <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} /> {atStopCount} {atStopCount === 1 ? t.bus : t.buses}</div>
          )}
          {!isNextStop && arrivingCount > 0 && (
            <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Timer size={12} />) }} /> {arrivingCount} {t.arriving}</div>
          )}
          {/* Show timetable in tooltip for vehicle stops (on hover) */}
          {isVehicleStop && scheduleInfo && scheduleLabel && (
            <div className="stop-popup__schedule">
              <div className="stop-popup__schedule-title">
                {scheduleInfo.serviceEnded && <em>{t.serviceEnded} · </em>}
                {scheduleLabel}
              </div>
              <div className="stop-schedule">
                {scheduleInfo.times.map((time) => (
                  <span
                    key={`tooltip-${id}-${time.raw}`}
                    className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}${scheduleInfo.serviceEnded ? ' stop-schedule__time--ended' : ''}`}
                  >
                    {time.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Show message if no schedule available for vehicle stop */}
          {isVehicleStop && !scheduleInfo && (
            <div className="stop-popup__no-schedule">{t.noSchedule}</div>
          )}
        </div>
      </Tooltip>
      {/* Only show popup for non-vehicle stops (stops from filter) */}
      {!isMobile && !isVehicleStop && (
        <Popup offset={[0, -12]} autoPan={false}>
          <div className="stop-popup">
            <strong>{name}</strong>
            {isCurrentStop && (
              <div>
                <span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} />{' '}
                {t.busHere}
              </div>
            )}
            {isNextStop && (
              <div>
                <span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<ArrowRight size={12} />) }} />{' '}
                {t.nextStop}
              </div>
            )}
            {!isCurrentStop && !isNextStop && atStopCount > 0 && (
              <div>
                <span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} />{' '}
                {atStopCount} {atStopCount === 1 ? t.bus : t.buses}
              </div>
            )}
            {!isNextStop && arrivingCount > 0 && (
              <div>
                <span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Timer size={12} />) }} />{' '}
                {arrivingCount} {t.arriving}
              </div>
            )}
            {scheduleInfo && scheduleLabel && (
              <div className="stop-popup__schedule">
                <div className="stop-popup__schedule-title">
                  {scheduleInfo.serviceEnded && <em>{t.serviceEnded} · </em>}
                  {scheduleLabel}
                </div>
                <div className="stop-schedule">
                  {scheduleInfo.times.map((time) => (
                    <span
                      key={`${id}-${time.raw}`}
                      className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}${scheduleInfo.serviceEnded ? ' stop-schedule__time--ended' : ''}`}
                    >
                      {time.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Popup>
      )}
    </CircleMarker>
  )
}

/**
 * Keep the selected stop centered on mobile when selected.
 */
function MobileFollowSelectedStop() {
  const map = useMap()
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
    if (!isMobile || targetLat == null || targetLon == null) return

    const zoom = map.getZoom()
    const size = map.getSize()
    const verticalOffset = Math.round(size.y * MOBILE_FOLLOW_OFFSET_RATIO)
    const stopPoint = map.project([targetLat, targetLon], zoom)
    const targetCenter = map.unproject(stopPoint.add([0, verticalOffset]), zoom)

    map.panTo(targetCenter, {
      animate: true,
      duration: MOBILE_FOLLOW_ANIMATION_SEC,
      easeLinearity: MOBILE_FOLLOW_EASE,
    })
  }, [map, isMobile, targetLat, targetLon, selectedStopId])

  return null
}

/**
 * Render the selected stop overlay circle above other elements.
 * On mobile: renders above the bottom sheet overlay.
 * On desktop: renders above the map for visual consistency.
 */
function SelectedStopOverlay() {
  const map = useMap()
  const { data: stopsData } = useStopsData()
  const isMobile = useAppStore((state) => state.isMobile)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const selectedStopId = useAppStore((state) => state.selectedStopId)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  // Find the selected stop's coordinates
  const selectedStop = useMemo(() => {
    if (!selectedStopId || !stopsData) return null
    return stopsData.features.find((f) => f.properties.id === selectedStopId) ?? null
  }, [stopsData, selectedStopId])

  const lastStopRef = useRef<typeof selectedStop>(null)
  if (selectedStop) {
    lastStopRef.current = selectedStop
  }

  const stopToRender = selectedStop ?? (selectedStopId ? lastStopRef.current : null)
  const coords = stopToRender?.geometry.coordinates
  const targetLon = coords?.[0]
  const targetLat = coords?.[1]

  // On mobile, only show when bottom sheet is open
  // On desktop, always show when a stop is selected
  const shouldRender = isMobile ? isBottomSheetOpen : true

  useEffect(() => {
    if (!shouldRender || targetLat == null || targetLon == null) {
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
  }, [map, shouldRender, targetLat, targetLon])

  if (!shouldRender || !position || !stopToRender) return null

  return createPortal(
    <div
      className="selected-stop-overlay"
      style={{ left: position.left, top: position.top }}
    >
      <div className="selected-stop-overlay__circle" />
    </div>,
    document.body
  )
}

export default function StopsLayer() {
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

  // Get highlighted stop IDs and route color from selected vehicle
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

  // Filter to only stops with valid coordinates
  const validStops = stopsData.features.filter(
    (f) => f.geometry.coordinates !== null
  )

  // Apply stop filter - only show stops that are explicitly selected
  // Also show current and next stops when a vehicle is selected
  const vehicleStopIds = new Set<number>()
  if (selectedVehicle && currentStopId != null) vehicleStopIds.add(currentStopId)
  if (selectedVehicle && nextStopId != null) vehicleStopIds.add(nextStopId)
  
  const visibleStops = validStops.filter((f) => {
    const id = f.properties.id
    // Show if it's the current or next stop of the selected vehicle
    if (vehicleStopIds.has(id)) return true
    // Show if it's a filtered stop
    if (filteredStopIds.size > 0 && filteredStopIds.has(id)) return true
    return false
  })

  const now = new Date()

  return (
    <>
      {visibleStops.map((feature) => {
        const { id, name, matchMethod } = feature.properties
        const [lon, lat] = feature.geometry.coordinates!
        
        const isCurrentStop = id === currentStopId
        const isNextStop = id === nextStopId
        const isVehicleRelatedStop = isCurrentStop || isNextStop
        const isSelected = id === selectedStopId
        const style = getStopStyle(isCurrentStop, isNextStop, isSelected, matchMethod, vehicleRouteColor)

        // Count vehicles heading to this stop
        const arrivingCount = vehicles.filter((v) => v.nextStopId === id).length
        const atStopCount = vehicles.filter((v) => v.stopId === id).length

        const scheduleCandidates = [
          { route: '1', schedule: route1Schedule },
          { route: '2', schedule: route2Schedule },
          { route: '3', schedule: route3Schedule },
          { route: 'X2', schedule: routeX2Schedule },
          { route: 'E2', schedule: routeE2Schedule },
          { route: 'X3', schedule: routeX3Schedule },
        ]

        // For current/next stops of selected vehicle, use the vehicle's route
        // Otherwise use the selected stop route from filter, or find any matching schedule
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
            isMobile={isMobile}
            selectedStopId={selectedStopId}
            setSelectedStopId={setSelectedStopId}
            t={t}
          />
        )
      })}
      <MobileFollowSelectedStop />
      <SelectedStopOverlay />
    </>
  )
}
