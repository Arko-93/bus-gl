// src/ui/StopFilter.tsx
// Stop filter - pill button that opens a dropdown with route-based stop filters

import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react'
import { X, MapPin, Route } from 'lucide-react'
import { useAppStore } from '../state/appStore'
import { useTranslation, useLocale } from '../i18n/useTranslation'
import { useStopsData } from '../data/useStopsData'
import { useRoute1Schedule, getStopOrderForDate, getScheduleServiceForDate } from '../data/route1Schedule'

interface Stop {
  id: number
  name: string
}

const ROUTE_1_COLOR = '#E91E8C'

export default function StopFilter() {
  const t = useTranslation()
  const { locale } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: stopsData, isLoading: stopsLoading } = useStopsData()
  const { data: route1Schedule, isLoading: scheduleLoading } = useRoute1Schedule()

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
  const isLoading = stopsLoading || scheduleLoading
  const scheduleService = getScheduleServiceForDate(new Date())

  const route1StopOrder = useMemo(() => {
    if (!route1Schedule) return []
    const order = getStopOrderForDate(route1Schedule, new Date())
    if (order.length > 0) return order
    const ids = new Set<number>()
    for (const key of Object.keys(route1Schedule.weekdays)) {
      const id = Number(key)
      if (Number.isFinite(id)) ids.add(id)
    }
    for (const key of Object.keys(route1Schedule.weekends)) {
      const id = Number(key)
      if (Number.isFinite(id)) ids.add(id)
    }
    return Array.from(ids)
  }, [route1Schedule, scheduleService])

  const route1Stops = useMemo<Stop[]>(() => {
    if (!stopsData || route1StopOrder.length === 0) return []
    const byId = new Map(
      stopsData.features
        .filter((feature) => feature.geometry.coordinates)
        .map((feature) => [feature.properties.id, feature.properties.name])
    )
    const ordered: Stop[] = []
    for (const id of route1StopOrder) {
      const name = byId.get(id)
      if (name) ordered.push({ id, name })
    }
    return ordered
  }, [stopsData, route1StopOrder])

  const isRoute1Active = selectedStopRoute === '1' && route1Stops.length > 0
  const isRoute1Disabled = route1Stops.length === 0 && !isRoute1Active

  const route1Index = useMemo(() => {
    return new Map(route1Stops.map((stop, index) => [stop.id, index]))
  }, [route1Stops])

  const getStopsForward = useCallback(
    (fromId: number, toId: number) => {
      if (route1Stops.length === 0) return route1Stops
      const fromIndex = route1Index.get(fromId)
      const toIndex = route1Index.get(toId)
      if (fromIndex == null || toIndex == null) return route1Stops
      if (fromIndex <= toIndex) {
        return route1Stops.slice(fromIndex, toIndex + 1)
      }
      return route1Stops.slice(fromIndex).concat(route1Stops.slice(0, toIndex + 1))
    },
    [route1Index, route1Stops]
  )

  const syncStopFilters = useCallback(() => {
    if (!isRoute1Active || route1Stops.length === 0) return
    if (!selectedStopRouteTripEnabled) {
      setStopFilters(route1Stops)
      return
    }
    if (!selectedStopRouteFromId || !selectedStopRouteToId) {
      setStopFilters(route1Stops)
      return
    }
    setStopFilters(getStopsForward(selectedStopRouteFromId, selectedStopRouteToId))
  }, [
    getStopsForward,
    isRoute1Active,
    route1Stops,
    selectedStopRouteFromId,
    selectedStopRouteToId,
    selectedStopRouteTripEnabled,
    setStopFilters,
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

  const handleRoute1Select = () => {
    if (isRoute1Active) {
      clearStopFilters()
      return
    }
    if (route1Stops.length === 0) return
    setSelectedStopRoute('1')
    setSelectedStopRouteTripEnabled(false)
    setSelectedStopRouteRange(null, null)
    setStopFilters(route1Stops)
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
    if (!isRoute1Active) return
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
              <button
                className={`stop-filter__route-btn${isRoute1Active ? ' stop-filter__route-btn--active' : ''}`}
                style={{ '--route-color': ROUTE_1_COLOR } as React.CSSProperties}
                onClick={handleRoute1Select}
                disabled={isRoute1Disabled}
                aria-pressed={isRoute1Active}
              >
                <span className="stop-filter__route-badge">
                  <Route size={14} />
                  <span>1</span>
                </span>
                <span className="stop-filter__route-text">
                  <span className="stop-filter__route-title">{t.route} 1</span>
                  <span className="stop-filter__route-subtitle">
                    {route1Stops.length} {t.busStops}
                  </span>
                </span>
              </button>
            )}
            {isRoute1Active && (
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
            {isRoute1Active && selectedStopRouteTripEnabled && route1Stops.length > 1 && (
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
                    {route1Stops.map((stop) => (
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
                    {route1Stops.map((stop) => (
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
