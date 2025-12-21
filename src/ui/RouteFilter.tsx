// src/ui/RouteFilter.tsx
// Multi-select route filter buttons

import { useAppStore } from '../state/appStore'
import { KNOWN_ROUTES } from '../data/ridangoRealtime'
import { useTranslation } from '../i18n/useTranslation'

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

export default function RouteFilter() {
  const enabledRoutes = useAppStore((state) => state.enabledRoutes)
  const toggleRoute = useAppStore((state) => state.toggleRoute)
  const setAllRoutes = useAppStore((state) => state.setAllRoutes)
  const t = useTranslation()

  const allEnabled = enabledRoutes.size === KNOWN_ROUTES.length

  return (
    <div className="route-filter" role="group" aria-label={t.filterByRoute}>
      <button
        className={`route-filter__btn route-filter__btn--all ${allEnabled ? 'route-filter__btn--active' : ''}`}
        onClick={() => setAllRoutes(!allEnabled)}
        aria-pressed={allEnabled}
      >
        {t.allRoutes}
      </button>
      {KNOWN_ROUTES.map((route) => {
        const isActive = enabledRoutes.has(route)
        const color = getRouteColor(route)
        
        return (
          <button
            key={route}
            className={`route-filter__btn ${isActive ? 'route-filter__btn--active' : 'route-filter__btn--inactive'}`}
            style={{
              '--route-color': color,
              backgroundColor: isActive ? color : '#e5e7eb',
              borderColor: color,
              color: isActive ? 'white' : color,
            } as React.CSSProperties}
            onClick={() => toggleRoute(route)}
            aria-pressed={isActive}
            aria-label={`${t.route} ${route}`}
          >
            {route}
          </button>
        )
      })}
    </div>
  )
}
