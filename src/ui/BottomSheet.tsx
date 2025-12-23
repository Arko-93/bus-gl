// src/ui/BottomSheet.tsx
// Mobile bottom sheet for vehicle and stop details

import { useEffect, useRef, useMemo } from 'react'
import { Gauge, MapPin, ArrowRight, Clock, CircleDot, Bus, Timer, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useStopsData, getStopById, createStopLookup } from '../data/useStopsData'
import { useTranslation } from '../i18n/useTranslation'
import type { Vehicle } from '../data/ridangoRealtime'
import type { StopFeature } from '../data/useStopsData'

/**
 * Route color mapping - matches Nuup Bussii official branding
 */
function getRouteColor(route: string): string {
  const colors: Record<string, string> = {
    '1': '#E91E8C',  // Pink/Magenta (Rute 1)
    '2': '#FFD700',  // Yellow (Rute 2)
    '3': '#4CAF50',  // Green (Rute 3)
    'X2': '#808080', // Gray (Rute X2)
    'E2': '#0066CC', // Blue (Rute E2)
    'X3': '#00b047', // Green with stripes (Rute X3)
  }
  return colors[route] || '#6b7280'
}

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
  
  const getTimeAgo = (ms: number): string => {
    if (ms === 0) return ''
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return `${seconds}${t.secondsAgo}`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${t.minutesAgo}`
    return `${Math.floor(minutes / 60)}${t.hoursAgo}`
  }
  
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
          <div className="bottom-sheet__row">
            <span className="bottom-sheet__label"><MapPin size={14} /> {t.currentStop}</span>
            <span className="bottom-sheet__value">{vehicle.stopName || t.inTransit}</span>
          </div>
          
          {vehicle.nextStopName && (
            <div className="bottom-sheet__row">
              <span className="bottom-sheet__label"><ArrowRight size={14} /> {t.nextStop}</span>
              <span className="bottom-sheet__value">{vehicle.nextStopName}</span>
            </div>
          )}
        </div>

        {vehicle.atStop && (
          <div className="bottom-sheet__badge bottom-sheet__badge--at-stop">
            <CircleDot size={14} /> {t.atStop}
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
  vehiclesAtStop: Vehicle[]
  vehiclesArriving: Vehicle[]
}

function StopDetails({ stop, vehiclesAtStop, vehiclesArriving }: StopDetailsProps) {
  const t = useTranslation()
  
  return (
    <div className="bottom-sheet__content">
      <div className="bottom-sheet__header">
        <div className="bottom-sheet__stop-icon"><CircleDot size={24} /></div>
        <div className="bottom-sheet__title">
          <h2>{stop.properties.name}</h2>
          <p className="bottom-sheet__headsign">Stop #{stop.properties.id}</p>
        </div>
      </div>

      <div className="bottom-sheet__details">
        {vehiclesAtStop.length > 0 && (
          <div className="bottom-sheet__section">
            <h3 className="bottom-sheet__section-title"><Bus size={16} /> {t.busHere}</h3>
            {vehiclesAtStop.map((v) => (
              <div key={v.id} className="bottom-sheet__bus-item">
                <span 
                  className={`bottom-sheet__route-badge bottom-sheet__route-badge--small ${v.route === 'X3' ? 'bottom-sheet__route-badge--x3' : ''}`}
                  style={{ backgroundColor: getRouteColor(v.route) }}
                >
                  {v.route}
                </span>
                <span className="bottom-sheet__bus-destination">
                  → {v.nextStopName || t.unknown}
                </span>
              </div>
            ))}
          </div>
        )}

        {vehiclesArriving.length > 0 && (
          <div className="bottom-sheet__section">
            <h3 className="bottom-sheet__section-title"><Timer size={16} /> {t.arriving}</h3>
            {vehiclesArriving.map((v) => (
              <div key={v.id} className="bottom-sheet__bus-item">
                <span 
                  className={`bottom-sheet__route-badge bottom-sheet__route-badge--small ${v.route === 'X3' ? 'bottom-sheet__route-badge--x3' : ''}`}
                  style={{ backgroundColor: getRouteColor(v.route) }}
                >
                  {v.route}
                </span>
                <span className="bottom-sheet__bus-destination">
                  {v.stopName ? <><MapPin size={12} /> {v.stopName}</> : t.inTransit}
                </span>
              </div>
            ))}
          </div>
        )}

        {vehiclesAtStop.length === 0 && vehiclesArriving.length === 0 && (
          <div className="bottom-sheet__empty">
            {t.noBusesAtStop}
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
  
  // Find current vehicle, but keep last known vehicle data if temporarily missing
  const lastVehicleRef = useRef<Vehicle | null>(null)
  const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId)
  
  // Update last known vehicle when we have new data
  if (currentVehicle) {
    lastVehicleRef.current = currentVehicle
  }
  
  // Use current vehicle if available, otherwise use last known (for brief data gaps)
  const selectedVehicle = currentVehicle ?? (selectedVehicleId ? lastVehicleRef.current : null)
  
  // Get selected stop and vehicles at/arriving
  const stopLookup = useMemo(() => {
    if (!stopsData) return new Map()
    return createStopLookup(stopsData)
  }, [stopsData])
  
  const selectedStop = useMemo(() => {
    return getStopById(selectedStopId, stopLookup)
  }, [selectedStopId, stopLookup])
  
  const vehiclesAtStop = useMemo(() => {
    if (selectedStopId === null) return []
    return vehicles.filter((v) => v.stopId === selectedStopId)
  }, [vehicles, selectedStopId])
  
  const vehiclesArriving = useMemo(() => {
    if (selectedStopId === null) return []
    return vehicles.filter((v) => v.nextStopId === selectedStopId && v.stopId !== selectedStopId)
  }, [vehicles, selectedStopId])

  // Close handler
  const handleClose = () => {
    setBottomSheetOpen(false)
    setSelectedVehicleId(null)
    setSelectedStopId(null)
  }

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

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
  const panelClassName = isMobile ? 'bottom-sheet' : 'detail-panel'
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
            vehiclesAtStop={vehiclesAtStop}
            vehiclesArriving={vehiclesArriving}
          />
        )}
      </div>
    </div>
  )
}
