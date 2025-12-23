// src/map/StopsLayer.tsx
// Layer for bus stops with highlighting for selected vehicle's stops

import { CircleMarker, Tooltip } from 'react-leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Bus, ArrowRight, Timer } from 'lucide-react'
import { useStopsData, type StopFeature } from '../data/useStopsData'
import { useAppStore } from '../state/appStore'
import { useVehiclesQuery } from '../data/vehiclesQuery'
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
      radius: 12,
      fillColor: '#3b82f6', // Blue for selected
      color: '#1d4ed8',
      weight: 4,
      fillOpacity: 1,
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

export default function StopsLayer() {
  const t = useTranslation()
  const { data: stopsData, isLoading, error } = useStopsData()
  const { data: vehicles = [] } = useVehiclesQuery()
  
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const selectedStopId = useAppStore((state) => state.selectedStopId)
  const setSelectedStopId = useAppStore((state) => state.setSelectedStopId)
  const filteredStopIds = useAppStore((state) => state.filteredStopIds)
  
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

        return (
          <CircleMarker
            key={id}
            center={[lat, lon]}
            {...style}
            eventHandlers={{
              click: () => {
                setSelectedStopId(isSelected ? null : id)
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
          </CircleMarker>
        )
      })}
    </>
  )
}
