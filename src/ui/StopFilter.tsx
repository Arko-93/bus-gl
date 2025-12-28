// src/ui/StopFilter.tsx
// Stop filter - pill button that opens a dropdown with route-based stop filters

import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react'
import { X, MapPin, Route } from 'lucide-react'
import { useAppStore } from '../state/appStore'
import { useTranslation, useLocale } from '../i18n/useTranslation'
import { useStopsData } from '../data/useStopsData'
import { useRoute1Schedule, getStopOrderForDate, getScheduleServiceForDate } from '../data/route1Schedule'
import { useRoute2Schedule } from '../data/route2Schedule'
import { useRoute3Schedule } from '../data/route3Schedule'
import { useRouteX2Schedule } from '../data/routeX2Schedule'
import { useRouteE2Schedule } from '../data/routeE2Schedule'
import { useRouteX3Schedule } from '../data/routeX3Schedule'
import { getRouteColor } from '../data/routeColors'
import { KNOWN_ROUTES, type KnownRoute } from '../data/ridangoRealtime'

interface Stop {
  id: number
  name: string
}

export default function StopFilter() {
  const t = useTranslation()
  const { locale } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: stopsData, isLoading: stopsLoading } = useStopsData()
  const { data: route1Schedule, isLoading: schedule1Loading } = useRoute1Schedule()
  const { data: route2Schedule, isLoading: schedule2Loading } = useRoute2Schedule()
  const { data: route3Schedule, isLoading: schedule3Loading } = useRoute3Schedule()
  const { data: routeX2Schedule, isLoading: scheduleX2Loading } = useRouteX2Schedule()
  const { data: routeE2Schedule, isLoading: scheduleE2Loading } = useRouteE2Schedule()
  const { data: routeX3Schedule, isLoading: scheduleX3Loading } = useRouteX3Schedule()

  const filteredStopIds = useAppStore((state) => state.filteredStopIds)
  const clearStopFilters = useAppStore((state) => state.clearStopFilters)
  const setStopFilters = useAppStore((state) => state.setStopFilters)
  const selectedStopRoute = useAppStore((state) => state.selectedStopRoute)
  const setSelectedStopRoute = useAppStore((state) => state.setSelectedStopRoute)
  const selectedStopRouteTripEnabled = useAppStore((state) => state.selectedStopRouteTripEnabled)
  const setSelectedStopRouteTripEnabled = useAppStore((state) => state.setSelectedStopRouteTripEnabled)
  const selectedStopRouteFromId = useAppStore((state) => state.selectedStopRouteFromId)
  const selectedStopRouteToId = useAppStore((state) => state.selectedStopRouteToId)
  const setSelectedStopRouteRange = useAppStore((state) => state.setSelectedStopRouteRange)

  const hasFilters = filteredStopIds.size > 0
  const isLoading = stopsLoading || schedule1Loading || schedule2Loading || schedule3Loading || scheduleX2Loading || scheduleE2Loading || scheduleX3Loading
  const scheduleService = getScheduleServiceForDate(new Date())

  const buildStopOrder = useCallback(
    (schedule: ReturnType<typeof useRoute1Schedule>['data']) => {
      if (!schedule) return []
      const order = getStopOrderForDate(schedule, new Date())
      if (order.length > 0) return order
      const ids = new Set<number>()
      for (const key of Object.keys(schedule.weekdays)) {
        const id = Number(key)
        if (Number.isFinite(id)) ids.add(id)
      }
      for (const key of Object.keys(schedule.weekends)) {
        const id = Number(key)
        if (Number.isFinite(id)) ids.add(id)
      }
      return Array.from(ids)
    },
    []
  )

  const routeStopOrders = useMemo(() => {
    return {
      '1': buildStopOrder(route1Schedule),
      '2': buildStopOrder(route2Schedule),
      '3': buildStopOrder(route3Schedule),
      'X2': buildStopOrder(routeX2Schedule),
      'E2': buildStopOrder(routeE2Schedule),
      'X3': buildStopOrder(routeX3Schedule),
    }
  }, [buildStopOrder, route1Schedule, route2Schedule, route3Schedule, routeX2Schedule, routeE2Schedule, routeX3Schedule, scheduleService])

  const routeStopsById = useMemo(() => {
    const map = new Map<string, Stop[]>()
    if (!stopsData) return map
    const byId = new Map(
      stopsData.features
        .filter((feature) => feature.geometry.coordinates)
        .map((feature) => [feature.properties.id, feature.properties.name])
    )
    for (const [routeId, order] of Object.entries(routeStopOrders)) {
      const ordered: Stop[] = []
      for (const id of order) {
        const name = byId.get(id)
        if (name) ordered.push({ id, name })
      }
      map.set(routeId, ordered)
    }
    return map
  }, [routeStopOrders, stopsData])

  const selectedRouteStops = useMemo(() => {
    if (!selectedStopRoute) return []
    return routeStopsById.get(selectedStopRoute) ?? []
  }, [routeStopsById, selectedStopRoute])

  const selectedRouteIndex = useMemo(() => {
    return new Map(selectedRouteStops.map((stop, index) => [stop.id, index]))
  }, [selectedRouteStops])

  const getStopsForward = useCallback(
    (fromId: number, toId: number) => {
      if (selectedRouteStops.length === 0) return selectedRouteStops
      const fromIndex = selectedRouteIndex.get(fromId)
      const toIndex = selectedRouteIndex.get(toId)
      if (fromIndex == null || toIndex == null) return selectedRouteStops
      if (fromIndex <= toIndex) {
        return selectedRouteStops.slice(fromIndex, toIndex + 1)
      }
      return selectedRouteStops.slice(fromIndex).concat(selectedRouteStops.slice(0, toIndex + 1))
    },
    [selectedRouteIndex, selectedRouteStops]
  )

  const syncStopFilters = useCallback(() => {
    if (!selectedStopRoute) return
    if (selectedRouteStops.length === 0) return
    if (!selectedStopRouteTripEnabled) {
      setStopFilters(selectedRouteStops)
      return
    }
    if (!selectedStopRouteFromId || !selectedStopRouteToId) {
      setStopFilters(selectedRouteStops)
      return
    }
    setStopFilters(getStopsForward(selectedStopRouteFromId, selectedStopRouteToId))
  }, [
    getStopsForward,
    selectedRouteStops,
    selectedStopRouteFromId,
    selectedStopRouteToId,
    selectedStopRouteTripEnabled,
    setStopFilters,
    selectedStopRoute,
  ])

  useEffect(() => {
    syncStopFilters()
  }, [syncStopFilters])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleRemoveAll = () => clearStopFilters()

  const handleRouteSelect = (routeId: KnownRoute) => {
    const stops = routeStopsById.get(routeId) ?? []
    if (selectedStopRoute === routeId) {
      clearStopFilters()
      return
    }
    if (stops.length === 0) return
    setSelectedStopRoute(routeId)
    setSelectedStopRouteTripEnabled(false)
    setSelectedStopRouteRange(null, null)
    setStopFilters(stops)
  }

  const handleFromChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const nextFrom = value ? Number(value) : null
    setSelectedStopRouteRange(nextFrom, selectedStopRouteToId)
  }

  const handleToChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const nextTo = value ? Number(value) : null
    setSelectedStopRouteRange(selectedStopRouteFromId, nextTo)
  }

  const handleModeSelect = (mode: 'full' | 'trip') => {
    if (!selectedStopRoute || selectedRouteStops.length === 0) return
    if (mode === 'trip') {
      setSelectedStopRouteTripEnabled(true)
      setSelectedStopRouteRange(null, null)
      return
    }
    setSelectedStopRouteTripEnabled(false)
    setSelectedStopRouteRange(null, null)
  }

  return (
    <div className="stop-filter" ref={containerRef} data-lang={locale}>
      {/* Main toggle button - matches route filter "All" button style */}
      <button
        className={`stop-filter__toggle ${isOpen ? 'stop-filter__toggle--active' : ''} ${hasFilters ? 'stop-filter__toggle--has-filters' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        title={t.filterStops}
      >
        <MapPin size={14} />
        <span className="stop-filter__btn-text">{t.busStops}</span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="stop-filter__panel">
          {/* Header with action button */}
          <div className="stop-filter__header">
            <span className="stop-filter__title">
              <MapPin size={14} />
              {t.busStops}
            </span>
            <div className="stop-filter__header-actions">
              {hasFilters && (
                <button 
                  className="stop-filter__action-btn stop-filter__action-btn--remove"
                  onClick={handleRemoveAll}
                >
                  {t.clearFilters}
                </button>
              )}
              <button 
                className="stop-filter__close" 
                onClick={() => { setIsOpen(false); }}
                aria-label={t.close}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="stop-filter__routes">
            <div className="stop-filter__section-label">{t.filterByRoute}</div>
            {isLoading ? (
              <div className="stop-filter__loading">{t.loading}</div>
            ) : (
              KNOWN_ROUTES.map((routeId) => {
                const isActive = selectedStopRoute === routeId && selectedRouteStops.length > 0
                const stops = routeStopsById.get(routeId) ?? []
                const isDisabled = stops.length === 0 && !isActive
                return (
                  <button
                    key={routeId}
                    className={`stop-filter__route-btn${isActive ? ' stop-filter__route-btn--active' : ''}`}
                    style={{ '--route-color': getRouteColor(routeId) } as React.CSSProperties}
                    onClick={() => handleRouteSelect(routeId)}
                    disabled={isDisabled}
                    aria-pressed={isActive}
                  >
                    <span className="stop-filter__route-badge">
                      <Route size={14} />
                      <span>{routeId}</span>
                    </span>
                    <span className="stop-filter__route-text">
                      <span className="stop-filter__route-title">{t.route} {routeId}</span>
                      <span className="stop-filter__route-subtitle">
                        {stops.length} {t.busStops}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
            {selectedStopRoute && selectedRouteStops.length > 0 && (
              <div className="stop-filter__mode">
                <button
                  className={`stop-filter__mode-btn${!selectedStopRouteTripEnabled ? ' stop-filter__mode-btn--active' : ''}`}
                  onClick={() => handleModeSelect('full')}
                  type="button"
                  aria-pressed={!selectedStopRouteTripEnabled}
                >
                  {t.fullRoute}
                </button>
                <button
                  className={`stop-filter__mode-btn${selectedStopRouteTripEnabled ? ' stop-filter__mode-btn--active' : ''}`}
                  onClick={() => handleModeSelect('trip')}
                  type="button"
                  aria-pressed={selectedStopRouteTripEnabled}
                >
                  {t.chooseTrip}
                </button>
              </div>
            )}
            {selectedStopRoute && selectedRouteStops.length > 1 && selectedStopRouteTripEnabled && (
              <div className="stop-filter__range">
                <label className="stop-filter__range-field">
                  <span className="stop-filter__range-label">{t.fromStop}</span>
                  <select
                    className="stop-filter__range-select"
                    value={selectedStopRouteFromId ?? ''}
                    onChange={handleFromChange}
                  >
                    <option value="" disabled>
                      {t.chooseStop}
                    </option>
                    {selectedRouteStops.map((stop) => (
                      <option key={`from-${stop.id}`} value={stop.id}>
                        {stop.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stop-filter__range-field">
                  <span className="stop-filter__range-label">{t.toStop}</span>
                  <select
                    className="stop-filter__range-select"
                    value={selectedStopRouteToId ?? ''}
                    onChange={handleToChange}
                  >
                    <option value="" disabled>
                      {t.chooseStop}
                    </option>
                    {selectedRouteStops.map((stop) => (
                      <option key={`to-${stop.id}`} value={stop.id}>
                        {stop.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
