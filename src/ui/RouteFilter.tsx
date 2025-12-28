// src/ui/RouteFilter.tsx
// Multi-select route filter buttons

import { useAppStore } from '../state/appStore'
import { KNOWN_ROUTES } from '../data/ridangoRealtime'
import { getRouteColor } from '../data/routeColors'
import { useTranslation, useLocale } from '../i18n/useTranslation'

export default function RouteFilter() {
  const enabledRoutes = useAppStore((state) => state.enabledRoutes)
  const toggleRoute = useAppStore((state) => state.toggleRoute)
  const setAllRoutes = useAppStore((state) => state.setAllRoutes)
  const t = useTranslation()
  const { locale } = useLocale()

  const allEnabled = enabledRoutes.size === KNOWN_ROUTES.length

  return (
    <div className="route-filter" role="group" aria-label={t.filterByRoute} data-lang={locale}>
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
            className={`route-filter__btn ${isActive ? 'route-filter__btn--active' : 'route-filter__btn--inactive'} ${route === 'X3' ? 'route-filter__btn--x3' : ''}`}
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
