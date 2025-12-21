// src/ui/BottomSheet.tsx
// Mobile bottom sheet for vehicle details

import { useEffect, useRef } from 'react'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useTranslation } from '../i18n/useTranslation'
import type { Vehicle } from '../data/ridangoRealtime'

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
    'X3': '#8BC34A', // Light Green (Rute X3)
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
  })
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
          className="bottom-sheet__route-badge"
          style={{ backgroundColor: getRouteColor(vehicle.route) }}
        >
          {vehicle.route}
        </div>
        <div className="bottom-sheet__title">
          <h2>{t.route} {vehicle.route}</h2>
          {vehicle.headsign && <p className="bottom-sheet__headsign">{vehicle.headsign}</p>}
        </div>
      </div>

      <div className="bottom-sheet__details">
        <div className="bottom-sheet__row">
          <span className="bottom-sheet__label">🚀 {t.speed}</span>
          <span className="bottom-sheet__value">{vehicle.speed} {t.kmh}</span>
        </div>
        
        <div className="bottom-sheet__row">
          <span className="bottom-sheet__label">📍 {t.currentStop}</span>
          <span className="bottom-sheet__value">{vehicle.stopName || t.inTransit}</span>
        </div>
        
        <div className="bottom-sheet__row">
          <span className="bottom-sheet__label">➡️ {t.nextStop}</span>
          <span className="bottom-sheet__value">{vehicle.nextStopName || t.unknown}</span>
        </div>
        
        <div className="bottom-sheet__row">
          <span className="bottom-sheet__label">🕐 {t.updated}</span>
          <span className="bottom-sheet__value">
            {formatTime(vehicle.updatedAtMs, locale)}
            <span className="bottom-sheet__time-ago"> ({getTimeAgo(vehicle.updatedAtMs)})</span>
          </span>
        </div>

        {vehicle.atStop && (
          <div className="bottom-sheet__badge bottom-sheet__badge--at-stop">
            🚏 {t.atStop}
          </div>
        )}
        
        {vehicle.isStale && (
          <div className="bottom-sheet__badge bottom-sheet__badge--stale">
            ⚠️ {t.dataOutdated}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BottomSheet() {
  const sheetRef = useRef<HTMLDivElement>(null)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const isOpen = useAppStore((state) => state.isBottomSheetOpen)
  const setBottomSheetOpen = useAppStore((state) => state.setBottomSheetOpen)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)
  const t = useTranslation()
  
  const { data: vehicles = [] } = useVehiclesQuery()
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId)

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setBottomSheetOpen(false)
        setSelectedVehicleId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setBottomSheetOpen, setSelectedVehicleId])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setBottomSheetOpen(false)
      setSelectedVehicleId(null)
    }
  }

  if (!isOpen || !selectedVehicle) return null

  return (
    <div className="bottom-sheet__backdrop" onClick={handleBackdropClick}>
      <div 
        ref={sheetRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${t.detailsFor} ${t.route} ${selectedVehicle.route}`}
      >
        <div className="bottom-sheet__handle" />
        <button
          className="bottom-sheet__close"
          onClick={() => {
            setBottomSheetOpen(false)
            setSelectedVehicleId(null)
          }}
          aria-label={t.close}
        >
          ✕
        </button>
        <VehicleDetails vehicle={selectedVehicle} />
      </div>
    </div>
  )
}
