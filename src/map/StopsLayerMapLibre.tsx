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
  isCurrentStop,
  isNextStop,
  isVehicleStop,
  isSelected,
  atStopCount,
  arrivingCount,
  scheduleInfo,
  scheduleLabel,
  isMobile,
  setSelectedStopId,
  t,
}: StopMarkerProps) {
  const handleClick = useCallback((event: MouseEvent) => {
    event.stopPropagation()
    if (isVehicleStop) return

    if (isMobile) {
      if (isSelected) {
        setSelectedStopId(null, { openPanel: true })
      } else {
        setSelectedStopId(id)
      }
    } else {
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
      <MarkerTooltip>
        <div>
          <strong>{name}</strong>
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
          {isVehicleStop && !scheduleInfo && (
            <div className="stop-popup__no-schedule">{t.noSchedule}</div>
          )}
        </div>
      </MarkerTooltip>
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

  const selectedScheduleInfo = selectedStop
    ? (() => {
        const preferredRoute = selectedStopRoute
        const resolvedSchedule =
          scheduleCandidates.find(
            (candidate) => candidate.route === preferredRoute && candidate.schedule
          ) ||
          scheduleCandidates.find(
            (candidate) =>
              candidate.schedule &&
              (candidate.schedule.weekdays[String(selectedStop.properties.id)] ||
                candidate.schedule.weekends[String(selectedStop.properties.id)])
          ) ||
          null

        const scheduleInfo = resolvedSchedule
          ? getUpcomingTimes(resolvedSchedule.schedule, selectedStop.properties.id, now, 6)
          : null

        const scheduleLabel =
          scheduleInfo && resolvedSchedule
            ? `${t.route} ${resolvedSchedule.route} · ${
                scheduleInfo.service === 'weekdays' ? t.scheduleWeekdays : t.scheduleWeekends
              }`
            : null

        return { scheduleInfo, scheduleLabel }
      })()
    : { scheduleInfo: null, scheduleLabel: null }

  const selectedStopArriving = selectedStop
    ? (arrivingCounts.get(selectedStop.properties.id) ?? 0)
    : 0
  const selectedStopAtStop = selectedStop
    ? (atStopCounts.get(selectedStop.properties.id) ?? 0)
    : 0
  const selectedIsCurrentStop = selectedStop?.properties.id === currentStopId
  const selectedIsNextStop = selectedStop?.properties.id === nextStopId
  const selectedSchedule = selectedScheduleInfo.scheduleInfo
  const selectedScheduleLabel = selectedScheduleInfo.scheduleLabel

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
            setSelectedStopId={setSelectedStopId}
            t={t}
          />
        )
      })}
      {selectedStop && !isMobile && selectedStop.geometry.coordinates && (
        <MapPopup
          longitude={selectedStop.geometry.coordinates[0]}
          latitude={selectedStop.geometry.coordinates[1]}
          closeButton={true}
          onClose={() => setSelectedStopId(null, { openPanel: false })}
        >
          <div>
            <strong>{selectedStop.properties.name}</strong>
            {selectedIsCurrentStop && (
              <div>
                <Bus size={12} /> {t.busHere}
              </div>
            )}
            {selectedIsNextStop && (
              <div>
                <ArrowRight size={12} /> {t.nextStop}
              </div>
            )}
            {!selectedIsCurrentStop && !selectedIsNextStop && selectedStopAtStop > 0 && (
              <div>
                <Bus size={12} /> {selectedStopAtStop} {selectedStopAtStop === 1 ? t.bus : t.buses}
              </div>
            )}
            {!selectedIsNextStop && selectedStopArriving > 0 && (
              <div>
                <Timer size={12} /> {selectedStopArriving} {t.arriving}
              </div>
            )}
            {selectedSchedule && selectedScheduleLabel && (
              <div className="stop-popup__schedule">
                <div className="stop-popup__schedule-title">
                  {selectedSchedule.serviceEnded && <em>{t.serviceEnded} · </em>}
                  {selectedScheduleLabel}
                </div>
                <div className="stop-schedule">
                  {selectedSchedule.times.map((time) => (
                    <span
                      key={`popup-${selectedStop.properties.id}-${time.raw}`}
                      className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}${selectedSchedule.serviceEnded ? ' stop-schedule__time--ended' : ''}`}
                    >
                      {time.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </MapPopup>
      )}
      <MobileFollowSelectedStop />
      <SelectedStopOverlay />
    </>
  )
}
