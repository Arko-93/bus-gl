// src/map/StopsLayer.tsx
// Layer for bus stops with highlighting for selected vehicle's stops

import { useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Bus, ArrowRight, Timer } from 'lucide-react'
import { useStopsData, type StopFeature } from '../data/useStopsData'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useRoute1Schedule, getUpcomingTimes } from '../data/route1Schedule'
import { useRoute2Schedule } from '../data/route2Schedule'
import { useTranslation } from '../i18n/useTranslation'

/**
 * Get stop marker style based on highlight state
 */
function getStopStyle(
  isCurrentStop: boolean,
  isNextStop: boolean,
  isSelected: boolean,
  matchMethod: StopFeature['properties']['matchMethod']
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

  // Highlighted stops (current or next)
  if (isCurrentStop) {
    return {
      ...base,
      radius: 10,
      fillColor: '#22c55e', // Green for current
      color: '#16a34a',
      weight: 3,
      fillOpacity: 0.9,
    }
  }

  if (isNextStop) {
    return {
      ...base,
      radius: 9,
      fillColor: '#f59e0b', // Amber for next
      color: '#d97706',
      weight: 3,
      fillOpacity: 0.9,
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
  
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const selectedStopId = useAppStore((state) => state.selectedStopId)
  const setSelectedStopId = useAppStore((state) => state.setSelectedStopId)
  const filteredStopIds = useAppStore((state) => state.filteredStopIds)
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedStopRoute = useAppStore((state) => state.selectedStopRoute)
  
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId)

  // Get highlighted stop IDs from selected vehicle
  const currentStopId = selectedVehicle?.stopId ?? null
  const nextStopId = selectedVehicle?.nextStopId ?? null

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
  // Default state: no stops selected = no stops shown
  const visibleStops = filteredStopIds.size > 0
    ? validStops.filter((f) => filteredStopIds.has(f.properties.id))
    : []

  const now = new Date()

  return (
    <>
      {visibleStops.map((feature) => {
        const { id, name, matchMethod } = feature.properties
        const [lon, lat] = feature.geometry.coordinates!
        
        const isCurrentStop = id === currentStopId
        const isNextStop = id === nextStopId
        const isSelected = id === selectedStopId
        const style = getStopStyle(isCurrentStop, isNextStop, isSelected, matchMethod)

        // Count vehicles heading to this stop
        const arrivingCount = vehicles.filter((v) => v.nextStopId === id).length
        const atStopCount = vehicles.filter((v) => v.stopId === id).length

        const scheduleCandidates = [
          { route: '1', schedule: route1Schedule },
          { route: '2', schedule: route2Schedule },
        ]

        const resolvedSchedule =
          scheduleCandidates.find(
            (candidate) => candidate.route === selectedStopRoute && candidate.schedule
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
          <CircleMarker
            key={id}
            center={[lat, lon]}
            {...style}
            eventHandlers={{
              click: () => {
                if (isSelected) {
                  setSelectedStopId(null, { openPanel: isMobile })
                } else if (isMobile) {
                  setSelectedStopId(id)
                } else {
                  setSelectedStopId(id, { openPanel: false })
                }
              },
              popupclose: () => {
                if (!isMobile && selectedStopId === id) {
                  setSelectedStopId(null, { openPanel: false })
                }
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div>
                <strong>{name}</strong>
                {isCurrentStop && <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} /> {t.busHere}</div>}
                {isNextStop && <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<ArrowRight size={12} />) }} /> {t.nextStop}</div>}
                {!isCurrentStop && !isNextStop && atStopCount > 0 && (
                  <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} /> {atStopCount} {atStopCount === 1 ? t.bus : t.buses}</div>
                )}
                {!isNextStop && arrivingCount > 0 && (
                  <div><span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Timer size={12} />) }} /> {arrivingCount} {t.arriving}</div>
                )}
              </div>
            </Tooltip>
            {!isMobile && (
              <Popup offset={[0, -12]} autoPan={false}>
                <div className="stop-popup">
                  <strong>{name}</strong>
                  {atStopCount > 0 && (
                    <div>
                      <span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Bus size={12} />) }} />{' '}
                      {atStopCount} {atStopCount === 1 ? t.bus : t.buses}
                    </div>
                  )}
                  {arrivingCount > 0 && (
                    <div>
                      <span dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(<Timer size={12} />) }} />{' '}
                      {arrivingCount} {t.arriving}
                    </div>
                  )}
                  {scheduleInfo && scheduleLabel && (
                    <div className="stop-popup__schedule">
                      <div className="stop-popup__schedule-title">{scheduleLabel}</div>
                      <div className="stop-schedule">
                        {scheduleInfo.times.map((time) => (
                          <span
                            key={`${id}-${time.raw}`}
                            className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}`}
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
      })}
      <MobileFollowSelectedStop />
      <SelectedStopOverlay />
    </>
  )
}
