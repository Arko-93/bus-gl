import { useCallback, memo } from 'react'
import { MapMarker, MarkerContent } from '@/components/ui/map'
import { useAppStore } from '../state/appStore'
import type { Vehicle } from '../data/ridangoRealtime'
import { getRouteColor, isAtDepot } from '../data/routeColors'

interface BusMarkerMapLibreProps {
  vehicle: Vehicle
}

const BusMarkerMapLibre = memo(function BusMarkerMapLibre({ vehicle }: BusMarkerMapLibreProps) {
  const isMobile = useAppStore((state) => state.isMobile)
  const selectedVehicleId = useAppStore((state) => state.selectedVehicleId)
  const isBottomSheetOpen = useAppStore((state) => state.isBottomSheetOpen)
  const setSelectedVehicleId = useAppStore((state) => state.setSelectedVehicleId)

  const handleClick = useCallback((event: MouseEvent) => {
    event.stopPropagation()
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
    }
  }, [isBottomSheetOpen, isMobile, selectedVehicleId, setSelectedVehicleId, vehicle.id])

  const atDepot = isAtDepot(vehicle.lat, vehicle.lon)
  const color = getRouteColor(vehicle.route)
  const staleClass = vehicle.isStale ? 'bus-marker--stale' : ''
  const depotClass = atDepot ? 'bus-marker--depot' : ''
  const x3Class = vehicle.route === 'X3' ? 'bus-marker--x3' : ''

  return (
    <MapMarker longitude={vehicle.lon} latitude={vehicle.lat} onClick={handleClick}>
      <MarkerContent className={`bus-marker ${staleClass} ${depotClass}`}>
        <div
          className={`bus-marker__inner ${x3Class} ${depotClass}`}
          style={{ backgroundColor: atDepot ? '#6b7280' : color }}
        >
          <span className="bus-marker__label">{vehicle.route}</span>
          {vehicle.isStale && <span className="bus-marker__stale-badge">!</span>}
          {atDepot && !vehicle.isStale && (
            <span className="bus-marker__depot-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </span>
          )}
        </div>
      </MarkerContent>
    </MapMarker>
  )
})

export default BusMarkerMapLibre
