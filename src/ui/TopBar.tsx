// src/ui/TopBar.tsx
// Status bar showing feed status and vehicle count

import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useAppStore, filterVehiclesByRoute } from '../state/appStore'
import { useTranslation } from '../i18n/useTranslation'
import StopSearch from './StopSearch'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'

const ENABLE_STATIC_LAYERS = import.meta.env.VITE_ENABLE_STATIC_LAYERS === 'true'

/**
 * Format time for display based on locale
 */
function formatTime(ms: number): string {
  const date = new Date(ms)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export default function TopBar() {
  const { data: vehicles = [], isFetching, isLoading } = useVehiclesQuery()
  const enabledRoutes = useAppStore((state) => state.enabledRoutes)
  const lastSuccessTime = useAppStore((state) => state.lastSuccessTime)
  const locale = useAppStore((state) => state.locale)
  const t = useTranslation()

  const filteredVehicles = filterVehiclesByRoute(vehicles, enabledRoutes)
  const staleCount = filteredVehicles.filter((v) => v.isStale).length

  return (
    <div className="top-bar">
      <div className="top-bar__left">
        <h1 className="top-bar__title">
          <span className="top-bar__icon"><img src="/bussit.svg" alt="Bussit" /></span>
          {t.appTitle}
        </h1>
        {ENABLE_STATIC_LAYERS && <StopSearch />}
      </div>
      
      <div className="top-bar__center">
        <div className="top-bar__status">
          <span 
            className={`top-bar__indicator ${isFetching ? 'top-bar__indicator--fetching' : ''}`} 
            title={isFetching ? t.updating : t.live}
          />
          {isLoading ? (
            <span className="top-bar__vehicle-count top-bar__vehicle-count--loading">
              {t.loading}
            </span>
          ) : (
            <>
              <span className="top-bar__vehicle-count">
                {filteredVehicles.length === 1 
                  ? `1 ${t.bus}`
                  : t.busesCount.replace('{count}', String(filteredVehicles.length))
                }
              </span>
              {staleCount > 0 && (
                <span className="top-bar__stale-count" title={`${staleCount} ${staleCount !== 1 ? t.buses : t.bus} ${t.stale}`}>
                  ({staleCount} {t.stale})
                </span>
              )}
            </>
          )}
        </div>
        {lastSuccessTime && (
          <div className="top-bar__update-time">
            {t.updated}: {formatTime(lastSuccessTime)}
          </div>
        )}
      </div>

      <div className="top-bar__right">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </div>
  )
}
