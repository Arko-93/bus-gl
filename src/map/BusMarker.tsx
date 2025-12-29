// src/map/BusMarker.tsx
// Individual bus marker with popup that follows bus in real-time

import { useCallback, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Vehicle } from '../data/ridangoRealtime'
import { useAppStore } from '../state/appStore'
import { useTranslation } from '../i18n/useTranslation'
import { getRouteColor, isAtDepot } from '../data/routeColors'

interface BusMarkerProps {
  vehicle: Vehicle
}

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

export default function BusMarker({ vehicle }: BusMarkerProps) {
  const map = useMap()
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const locale = useAppStore((state) => state.locale)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)
  const t = useTranslation()

  // Stable ref for imperative marker control
  const markerRef = useRef<L.Marker | null>(null)
  const keepOpenRef = useRef(false)
  const suppressCloseUntilRef = useRef(0)
  const iconSignatureRef = useRef<string>('')

  const getTimeAgo = useCallback((ms: number): string => {
    if (ms === 0) return ''
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return `${seconds}${t.secondsAgo}`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${t.minutesAgo}`
    return `${Math.floor(minutes / 60)}${t.hoursAgo}`
  }, [t.hoursAgo, t.minutesAgo, t.secondsAgo])

  const createIcon = () => {
    const atDepot = isAtDepot(vehicle.lat, vehicle.lon)
    const color = getRouteColor(vehicle.route)
    const staleClass = vehicle.isStale ? 'bus-marker--stale' : ''
    const depotClass = atDepot ? 'bus-marker--depot' : ''
    const x3Class = vehicle.route === 'X3' ? 'bus-marker--x3' : ''

    return L.divIcon({
      className: `bus-marker ${staleClass} ${depotClass}`,
      html: `
        <div class="bus-marker__inner ${x3Class} ${depotClass}" style="background-color: ${atDepot ? '#6b7280' : color}">
          <span class="bus-marker__label">${vehicle.route}</span>
          ${vehicle.isStale ? '<span class="bus-marker__stale-badge">!</span>' : ''}
          ${atDepot && !vehicle.isStale ? '<span class="bus-marker__depot-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg></span>' : ''}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    })
  }

  const getIconSignature = (current: Vehicle) => {
    const atDepot = isAtDepot(current.lat, current.lon)
    return `${current.route}|${current.isStale ? 1 : 0}|${atDepot ? 1 : 0}`
  }

  const buildPopupContent = useCallback(() => {
    const atDepot = isAtDepot(vehicle.lat, vehicle.lon)
    const alertIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
    const gearIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>'

    let html = '<div class="bus-popup">'
    html += `<h3 class="bus-popup__route" style="color: ${getRouteColor(vehicle.route)}">${t.route} ${vehicle.route}</h3>`
    html += '<div class="bus-popup__details">'
    html += '<div class="bus-popup__section">'
    if (!vehicle.atStop) {
      html += `<div class="bus-popup__row"><span class="bus-popup__label">${t.currentStop}:</span><span>${vehicle.stopName || t.inTransit}</span></div>`
    }
    if (vehicle.nextStopName) {
      html += `<div class="bus-popup__row"><span class="bus-popup__label">${t.nextStop}:</span><span>${vehicle.nextStopName}</span></div>`
    }
    html += '</div>'
    if (vehicle.atStop) {
      const stopLabel = vehicle.stopName || t.unknown
      html += `<div class="bus-popup__at-stop">${t.atStop}: ${stopLabel}</div>`
    }
    if (atDepot) html += `<div class="bus-popup__at-depot"><span>${gearIcon}</span> ${t.atDepot}</div>`
    if (vehicle.isStale) html += `<div class="bus-popup__stale-warning"><span>${alertIcon}</span> ${t.dataOutdated}</div>`
    html += '<div class="bus-popup__log">'
    html += `<div class="bus-popup__row"><span class="bus-popup__label">${t.speed}:</span><span>${vehicle.speed} ${t.kmh}</span></div>`
    html += `<div class="bus-popup__row"><span class="bus-popup__label">${t.updated}:</span><span>${formatTime(vehicle.updatedAtMs, locale)}<span class="bus-popup__time-ago"> (${getTimeAgo(vehicle.updatedAtMs)})</span></span></div>`
    html += '</div>'
    html += '</div></div>'
    return html
  }, [getTimeAgo, locale, t, vehicle])

  // Create marker ONCE on mount - use imperative Leaflet API
  useEffect(() => {
    const marker = L.marker([vehicle.lat, vehicle.lon], { icon: createIcon() })
    marker.addTo(map)
    iconSignatureRef.current = getIconSignature(vehicle)

    // Bind popup for desktop - always bind it so it can be opened on click
    if (!isMobile) {
      marker.bindPopup(buildPopupContent(), {
        autoPan: false,
        closeOnClick: false,
        autoClose: false,
      })
    }

  // Click handler
  marker.on('click', () => {
    if (isMobile) {
      const shouldRefocus = selectedVehicleId === vehicle.id && !isBottomSheetOpen
      if (shouldRefocus) {
        setSelectedVehicleId(null, { openPanel: false })
        requestAnimationFrame(() => {
          setSelectedVehicleId(vehicle.id, { openPanel: false })
        })
      } else {
        setSelectedVehicleId(vehicle.id, { openPanel: false })
      }
    } else {
      setSelectedVehicleId(vehicle.id, { openPanel: false })
      keepOpenRef.current = true
      marker.openPopup()
    }
  })

    // Track manual close
  marker.on('popupclose', () => {
    if (Date.now() < suppressCloseUntilRef.current) return
    keepOpenRef.current = false
    if (!isMobile) {
      const state = useAppStore.getState()
      const currentSelectedId = state.selectedVehicleId
      const currentSelectedStopId = state.selectedStopId
      // Don't deselect bus if a stop popup is open (user clicked on current/next stop)
      if (currentSelectedStopId !== null) return
      if (currentSelectedId === vehicle.id) {
        setSelectedVehicleId(null, { openPanel: false })
      }
    }
  })
    marker.on('popupopen', () => {
      keepOpenRef.current = true
    })

    markerRef.current = marker

    // Cleanup on unmount
    return () => {
      marker.remove()
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isMobile])

  // React to selection changes (desktop only)
  useEffect(() => {
    if (isMobile) return
    const marker = markerRef.current
    if (!marker) return

    const popup = marker.getPopup()
    // If this marker is selected, ensure popup open and flagged
    if (selectedVehicleId === vehicle.id) {
      if (popup) {
        popup.setContent(buildPopupContent())
        keepOpenRef.current = true
        marker.openPopup()
      }
    } else {
      // Deselect: close popup and clear flag
      keepOpenRef.current = false
      if (popup) {
        popup.close()
      }
    }
  }, [selectedVehicleId, isMobile, buildPopupContent, vehicle.id])

  // Update marker position and content on every vehicle update
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    const wasOpen = !isMobile && marker.isPopupOpen()
    const nextLatLng: [number, number] = [vehicle.lat, vehicle.lon]
    const shouldKeepOpen = !isMobile && (keepOpenRef.current || wasOpen)

    if (shouldKeepOpen) {
      suppressCloseUntilRef.current = Date.now() + 300
    }

    // Move marker - popup follows automatically!
    marker.setLatLng(nextLatLng)

    const iconSignature = getIconSignature(vehicle)
    if (iconSignature !== iconSignatureRef.current) {
      if (shouldKeepOpen) {
        suppressCloseUntilRef.current = Date.now() + 500
      }
      marker.setIcon(createIcon())
      iconSignatureRef.current = iconSignature
    }

    // Update popup content if it exists and keep open if user wanted
    if (!isMobile) {
      const popup = marker.getPopup()
      if (popup) {
        popup.setContent(buildPopupContent())
        if (shouldKeepOpen) {
          popup.setLatLng(nextLatLng)
          keepOpenRef.current = true
          marker.openPopup()
        }
      }
    }

    if (shouldKeepOpen) {
      const raf = requestAnimationFrame(() => {
        const current = markerRef.current
        if (current && keepOpenRef.current && !current.isPopupOpen()) {
          current.openPopup()
        }
      })
      return () => cancelAnimationFrame(raf)
    }
  })

  // No JSX - marker is created imperatively
  return null
}
