// src/map/BusMarker.tsx
// Individual bus marker with popup/click handling

import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Vehicle } from '../data/ridangoRealtime'
import { useAppStore } from '../state/appStore'
import { useTranslation } from '../i18n/useTranslation'

interface BusMarkerProps {
  vehicle: Vehicle
}

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
  return colors[route] || '#6b7280' // gray fallback
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

export default function BusMarker({ vehicle }: BusMarkerProps) {
  const isMobile = useAppStore((state) => state.isMobile)
  const locale = useAppStore((state) => state.locale)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)
  const t = useTranslation()

  const icon = useMemo(() => {
    const color = getRouteColor(vehicle.route)
    const staleClass = vehicle.isStale ? 'bus-marker--stale' : ''
    
    return L.divIcon({
      className: `bus-marker ${staleClass}`,
      html: `
        <div class="bus-marker__inner" style="background-color: ${color}">
          <span class="bus-marker__label">${vehicle.route}</span>
          ${vehicle.isStale ? '<span class="bus-marker__stale-badge">!</span>' : ''}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    })
  }, [vehicle.route, vehicle.isStale])

  const handleClick = () => {
    // On mobile, open bottom sheet instead of popup
    if (isMobile) {
      setSelectedVehicleId(vehicle.id)
    }
  }

  const getTimeAgo = (ms: number): string => {
    if (ms === 0) return ''
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return `${seconds}${t.secondsAgo}`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${t.minutesAgo}`
    return `${Math.floor(minutes / 60)}${t.hoursAgo}`
  }

  return (
    <Marker
      position={[vehicle.lat, vehicle.lon]}
      icon={icon}
      eventHandlers={{
        click: handleClick,
      }}
    >
      {/* Desktop only: show popup on click. On mobile, bottom sheet handles details */}
      {!isMobile && (
        <Popup>
          <div className="bus-popup">
            <h3 className="bus-popup__route" style={{ color: getRouteColor(vehicle.route) }}>
              {t.route} {vehicle.route}
            </h3>
            {vehicle.headsign && (
              <p className="bus-popup__headsign">{vehicle.headsign}</p>
            )}
            <div className="bus-popup__details">
              <div className="bus-popup__row">
                <span className="bus-popup__label">{t.speed}:</span>
                <span>{vehicle.speed} {t.kmh}</span>
              </div>
              <div className="bus-popup__row">
                <span className="bus-popup__label">{t.currentStop}:</span>
                <span>{vehicle.stopName || t.inTransit}</span>
              </div>
              <div className="bus-popup__row">
                <span className="bus-popup__label">{t.nextStop}:</span>
                <span>{vehicle.nextStopName || t.unknown}</span>
              </div>
              <div className="bus-popup__row">
                <span className="bus-popup__label">{t.updated}:</span>
                <span>
                  {formatTime(vehicle.updatedAtMs, locale)}
                  <span className="bus-popup__time-ago"> ({getTimeAgo(vehicle.updatedAtMs)})</span>
                </span>
              </div>
              {vehicle.atStop && (
                <div className="bus-popup__at-stop">
                  🚏 {t.atStop}
                </div>
              )}
              {vehicle.isStale && (
                <div className="bus-popup__stale-warning">
                  ⚠️ {t.dataOutdated}
                </div>
              )}
            </div>
          </div>
        </Popup>
      )}
    </Marker>
  )
}
