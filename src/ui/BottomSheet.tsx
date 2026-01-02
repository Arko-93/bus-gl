// src/ui/BottomSheet.tsx
// Mobile bottom sheet for vehicle and stop details

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Gauge, MapPin, ArrowRight, Clock, Bus, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useStopsData, getStopById, createStopLookup } from '../data/useStopsData'
import { useRoute1Schedule, getUpcomingTimes } from '../data/route1Schedule'
import { useRoute2Schedule } from '../data/route2Schedule'
import { useRoute3Schedule } from '../data/route3Schedule'
import { useRouteX2Schedule } from '../data/routeX2Schedule'
import { useRouteE2Schedule } from '../data/routeE2Schedule'
import { useRouteX3Schedule } from '../data/routeX3Schedule'
import { useTranslation } from '../i18n/useTranslation'
import { getRouteColor } from '../data/routeColors'
import { type KnownRoute } from '../data/ridangoRealtime'
import type { Vehicle } from '../data/ridangoRealtime'
import type { StopFeature } from '../data/useStopsData'

/**
 * Format timestamp for display
 */
function formatTime(ms: number, locale: string): string {
  if (ms === 0) return ''
  const date = new Date(ms)
  const localeMap: Record<string, string> = {
    kl: 'da-DK',
    da: 'da-DK',
    en: 'en-GB',
  }
  return date.toLocaleTimeString(localeMap[locale] || 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(/[.]/g, ':')
}

interface VehicleDetailsProps {
  vehicle: Vehicle
}

function VehicleDetails({ vehicle }: VehicleDetailsProps) {
  const t = useTranslation()
  const locale = useAppStore((state) => state.locale)
  const lastSuccessTime = useAppStore((state) => state.lastSuccessTime)
  const { data: route1Schedule } = useRoute1Schedule()
  const { data: route2Schedule } = useRoute2Schedule()
  const { data: route3Schedule } = useRoute3Schedule()
  const { data: routeX2Schedule } = useRouteX2Schedule()
  const { data: routeE2Schedule } = useRouteE2Schedule()
  const { data: routeX3Schedule } = useRouteX3Schedule()

  // Get schedule for this vehicle's route
  const scheduleCandidates = [
    { route: '1', schedule: route1Schedule },
    { route: '2', schedule: route2Schedule },
    { route: '3', schedule: route3Schedule },
    { route: 'X2', schedule: routeX2Schedule },
    { route: 'E2', schedule: routeE2Schedule },
    { route: 'X3', schedule: routeX3Schedule },
  ]
  const vehicleSchedule = scheduleCandidates.find((c) => c.route === vehicle.route)?.schedule ?? null

  // Get upcoming times for current stop
  const currentStopSchedule = vehicleSchedule && vehicle.stopId
    ? getUpcomingTimes(vehicleSchedule, vehicle.stopId, new Date(), 4)
    : null

  // Get upcoming times for next stop
  const nextStopSchedule = vehicleSchedule && vehicle.nextStopId
    ? getUpcomingTimes(vehicleSchedule, vehicle.nextStopId, new Date(), 4)
    : null
  
  const referenceTime = lastSuccessTime ?? vehicle.updatedAtMs
  const getTimeAgo = useCallback((ms: number): string => {
    if (ms === 0) return ''
    const seconds = Math.max(0, Math.floor((referenceTime - ms) / 1000))
    if (seconds < 60) return `${seconds}${t.secondsAgo}`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${t.minutesAgo}`
    return `${Math.floor(minutes / 60)}${t.hoursAgo}`
  }, [referenceTime, t.hoursAgo, t.minutesAgo, t.secondsAgo])
  
  return (
    <div className="bottom-sheet__content">
      <div className="bottom-sheet__header">
        <div 
          className={`bottom-sheet__route-badge ${vehicle.route === 'X3' ? 'bottom-sheet__route-badge--x3' : ''}`}
          style={{ backgroundColor: getRouteColor(vehicle.route) }}
        >
          {vehicle.route}
        </div>
        <div className="bottom-sheet__title">
          <h2>{t.route} {vehicle.route}</h2>
        </div>
      </div>

      <div className="bottom-sheet__details">
        <div className="bottom-sheet__group bottom-sheet__group--primary">
          {!vehicle.atStop && (
            <div className="bottom-sheet__stop-section">
              <div className="bottom-sheet__row">
                <span className="bottom-sheet__label"><MapPin size={14} /> {t.currentStop}</span>
                <span className="bottom-sheet__value">{vehicle.stopName || t.inTransit}</span>
              </div>
              {currentStopSchedule && (
                <div className={`stop-schedule stop-schedule--compact${vehicle.route === 'X3' ? ' stop-schedule--x3' : ''}`}>
                  {currentStopSchedule.serviceEnded && <span className="stop-schedule__ended-label">{t.serviceEnded}</span>}
                  {currentStopSchedule.times.map((time) => (
                    <span
                      key={`current-${time.raw}`}
                      className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}${currentStopSchedule.serviceEnded ? ' stop-schedule__time--ended' : ''}`}
                    >
                      {time.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {vehicle.nextStopName && (
            <div className="bottom-sheet__stop-section">
              <div className="bottom-sheet__row">
                <span className="bottom-sheet__label"><ArrowRight size={14} /> {t.nextStop}</span>
                <span className="bottom-sheet__value">{vehicle.nextStopName}</span>
              </div>
              {nextStopSchedule && (
                <div className={`stop-schedule stop-schedule--compact${vehicle.route === 'X3' ? ' stop-schedule--x3' : ''}`}>
                  {nextStopSchedule.serviceEnded && <span className="stop-schedule__ended-label">{t.serviceEnded}</span>}
                  {nextStopSchedule.times.map((time) => (
                    <span
                      key={`next-${time.raw}`}
                      className={`stop-schedule__time${time.isNext ? ' stop-schedule__time--next' : ''}${nextStopSchedule.serviceEnded ? ' stop-schedule__time--ended' : ''}`}
                    >
                      {time.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {vehicle.atStop && (
          <div className="bottom-sheet__badge bottom-sheet__badge--at-stop">
            {t.atStop}: {vehicle.stopName ?? t.unknown}
          </div>
        )}
        
        {vehicle.isStale && (
          <div className="bottom-sheet__badge bottom-sheet__badge--stale">
            <AlertTriangle size={14} /> {t.dataOutdated}
          </div>
        )}

        <div className="bottom-sheet__group bottom-sheet__group--log">
          <div className="bottom-sheet__row">
            <span className="bottom-sheet__label"><Gauge size={14} /> {t.speed}</span>
            <span className="bottom-sheet__value">{vehicle.speed} {t.kmh}</span>
          </div>
          
          <div className="bottom-sheet__row">
            <span className="bottom-sheet__label"><Clock size={14} /> {t.updated}</span>
            <span className="bottom-sheet__value">
              {formatTime(vehicle.updatedAtMs, locale)}
              <span className="bottom-sheet__time-ago"> ({getTimeAgo(vehicle.updatedAtMs)})</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StopDetailsProps {
  stop: StopFeature
  headingVehicles: Vehicle[]
}

function StopDetails({ stop, headingVehicles }: StopDetailsProps) {
  const t = useTranslation()
  const { data: route1Schedule } = useRoute1Schedule()
  const { data: route2Schedule } = useRoute2Schedule()
  const { data: route3Schedule } = useRoute3Schedule()
  const { data: routeX2Schedule } = useRouteX2Schedule()
  const { data: routeE2Schedule } = useRouteE2Schedule()
  const { data: routeX3Schedule } = useRouteX3Schedule()
  const selectedStopRoute = useAppStore((state) => state.selectedStopRoute)
  const setSelectedStopRoute = useAppStore((state) => state.setSelectedStopRoute)

  const scheduleCandidates = useMemo(() => [
    { route: '1' as KnownRoute, schedule: route1Schedule },
    { route: '2' as KnownRoute, schedule: route2Schedule },
    { route: '3' as KnownRoute, schedule: route3Schedule },
    { route: 'X2' as KnownRoute, schedule: routeX2Schedule },
    { route: 'E2' as KnownRoute, schedule: routeE2Schedule },
    { route: 'X3' as KnownRoute, schedule: routeX3Schedule },
  ], [route1Schedule, route2Schedule, route3Schedule, routeX2Schedule, routeE2Schedule, routeX3Schedule])

  // Determine which routes serve this stop
  const routesServingStop = useMemo(() => {
    const routes: KnownRoute[] = []
    for (const candidate of scheduleCandidates) {
      if (candidate.schedule) {
        const stopIdStr = String(stop.properties.id)
        if (candidate.schedule.weekdays[stopIdStr] || candidate.schedule.weekends[stopIdStr]) {
          routes.push(candidate.route)
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

  const resolvedSchedule =
    scheduleCandidates.find(
      (candidate) => candidate.route === selectedStopRoute && candidate.schedule
    ) ||
    scheduleCandidates.find(
      (candidate) =>
        candidate.schedule &&
        (candidate.schedule.weekdays[String(stop.properties.id)] ||
          candidate.schedule.weekends[String(stop.properties.id)])
    ) ||
    null

  const scheduleInfo = resolvedSchedule
    ? getUpcomingTimes(resolvedSchedule.schedule, stop.properties.id, new Date(), 6)
    : null

  const scheduleLabel =
    scheduleInfo && resolvedSchedule
      ? `${t.route} ${resolvedSchedule.route} · ${
          scheduleInfo.service === 'weekdays' ? t.scheduleWeekdays : t.scheduleWeekends
        }`
      : null

  // Get the color for schedule times based on selected route
  const scheduleRouteColor = resolvedSchedule ? getRouteColor(resolvedSchedule.route) : null
  const isX3Schedule = resolvedSchedule?.route === 'X3'
  
  return (
    <div className="bottom-sheet__content">
      <div className="bottom-sheet__header bottom-sheet__header--stop">
        <div className="bottom-sheet__title">
          <h2>{stop.properties.name}</h2>
        </div>
        <div className="bottom-sheet__route-badges">
          {sortedRoutes.length > 0 ? (
            sortedRoutes.map((route) => {
              const isActive = route === activeRoute
              return (
                <button
                  key={route}
                  className={`bottom-sheet__route-badge ${isActive ? 'bottom-sheet__route-badge--active' : 'bottom-sheet__route-badge--small'} ${route === 'X3' ? 'bottom-sheet__route-badge--x3' : ''}`}
                  style={{ backgroundColor: getRouteColor(route) }}
                  onClick={() => setSelectedStopRoute(route)}
                >
                  {route}
                </button>
              )
            })
          ) : (
            <span className="bottom-sheet__route-badge bottom-sheet__route-badge--small" style={{ backgroundColor: '#6b7280' }}>
              ?
            </span>
          )}
        </div>
      </div>

      <div className="bottom-sheet__details">
        {headingVehicles.length > 0 && (
          <div className="bottom-sheet__section">
            <h3 className="bottom-sheet__section-title"><Bus size={16} /> {t.busHere}</h3>
            <div className="bottom-sheet__heading-list">
              {headingVehicles.map((vehicle) => (
                <span
                  key={vehicle.id}
                  className={`bottom-sheet__route-badge bottom-sheet__route-badge--small ${vehicle.route === 'X3' ? 'bottom-sheet__route-badge--x3' : ''}`}
                  style={{ backgroundColor: getRouteColor(vehicle.route) }}
                >
                  {vehicle.route}
                </span>
              ))}
            </div>
          </div>
        )}

        {scheduleInfo && scheduleLabel && (
          <div className="bottom-sheet__section">
            <h3 className="bottom-sheet__section-title">
              {scheduleInfo.serviceEnded && <em>{t.serviceEnded} · </em>}
              {scheduleLabel}
            </h3>
            <div className={`stop-schedule${isX3Schedule ? ' stop-schedule--x3' : ''}`}>
              {scheduleInfo.times.map((time) => (
                <span
                  key={`${stop.properties.id}-${time.raw}`}
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
    </div>
  )
}

export default function BottomSheet() {
  const sheetRef = useRef<HTMLDivElement>(null)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const selectedStopId = useAppStore((state) => state.selectedStopId)
  const isOpen = useAppStore((state) => state.isBottomSheetOpen)
  const isMobile = useAppStore((state) => state.isMobile)
  const setBottomSheetOpen = useAppStore((state) => state.setBottomSheetOpen)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)
  const setSelectedStopId = useAppStore((state) => state.setSelectedStopId)
  const t = useTranslation()
  
  const { data: vehicles = [] } = useVehiclesQuery()
  const { data: stopsData } = useStopsData()
  
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )
  
  // Get selected stop and vehicles heading here
  const stopLookup = useMemo(() => {
    if (!stopsData) return new Map()
    return createStopLookup(stopsData)
  }, [stopsData])
  
  const selectedStop = useMemo(() => {
    return getStopById(selectedStopId, stopLookup)
  }, [selectedStopId, stopLookup])
  
  const headingVehicles = useMemo(() => {
    if (selectedStopId === null) return []
    return vehicles.filter(
      (vehicle) => vehicle.nextStopId === selectedStopId || vehicle.stopId === selectedStopId
    )
  }, [vehicles, selectedStopId])

  // Close handler
  const handleClose = useCallback(() => {
    setBottomSheetOpen(false)
    setSelectedVehicleId(null)
    setSelectedStopId(null)
  }, [setBottomSheetOpen, setSelectedStopId, setSelectedVehicleId])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isOpen])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  // Determine what to show
  const showVehicle = selectedVehicle !== null && selectedVehicle !== undefined
  const showStop = selectedStop !== null && !showVehicle

  if (!isOpen || (!showVehicle && !showStop)) return null

  const ariaLabel = showVehicle 
    ? `${t.detailsFor} ${t.route} ${selectedVehicle!.route}`
    : `${t.stopDetails}: ${selectedStop!.properties.name}`

  // Different styling for desktop vs mobile
  const typeModifier = showVehicle ? 'bottom-sheet--bus' : 'bottom-sheet--stop'
  const panelClassName = isMobile ? `bottom-sheet ${typeModifier}` : 'detail-panel'
  const backdropClassName = isMobile ? 'bottom-sheet__backdrop' : 'detail-panel__backdrop'

  return (
    <div className={backdropClassName} onClick={handleBackdropClick}>
      <div 
        ref={sheetRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {isMobile && <div className="bottom-sheet__handle" />}
        <button
          className={isMobile ? 'bottom-sheet__close' : 'detail-panel__close'}
          onClick={handleClose}
          aria-label={t.close}
        >
          <X size={20} />
        </button>
        {showVehicle && <VehicleDetails vehicle={selectedVehicle!} />}
        {showStop && (
          <StopDetails 
            stop={selectedStop!} 
            headingVehicles={headingVehicles}
          />
        )}
      </div>
    </div>
  )
}
