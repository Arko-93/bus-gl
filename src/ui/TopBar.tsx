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
function formatTime(ms: number, locale: string): string {
  const date = new Date(ms)
  const localeMap: Record<string, string> = {
    kl: 'da-DK', // Use Danish locale for Greenlandic (closest match)
    da: 'da-DK',
    en: 'en-GB',
  }
  return date.toLocaleTimeString(localeMap[locale] || 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
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
          <span className="top-bar__icon">🚌</span>
          {t.appTitle}
        </h1>
        {ENABLE_STATIC_LAYERS && <StopSearch />}
      </div>
      
      <div className="top-bar__right">
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
                {filteredVehicles.length} {filteredVehicles.length !== 1 ? t.buses : t.bus}
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
            {t.updated}: {formatTime(lastSuccessTime, locale)}
          </div>
        )}
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </div>
  )
}
