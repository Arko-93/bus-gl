// src/ui/StopFilter.tsx
// Stop filter - pill button that opens a dropdown with route-based stop filters

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { X, MapPin, Route, Search, ChevronDown } from 'lucide-react'
import { useAppStore } from '../state/appStore'
import { useTranslation, useLocale } from '../i18n/useTranslation'
import { useStopsData } from '../data/useStopsData'
import { useRoute1Schedule, getStopOrderForDate } from '../data/route1Schedule'
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

interface SearchableStopSelectProps {
  stops: Stop[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder: string
  label: string
}

function SearchableStopSelect({ stops, value, onChange, placeholder, label }: SearchableStopSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedStop = useMemo(() => stops.find((s) => s.id === value), [stops, value])

  const filteredStops = useMemo(() => {
    if (!search.trim()) return stops
    const query = search.toLowerCase()
    return stops.filter((stop) => stop.name.toLowerCase().includes(query))
  }, [stops, search])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }

  const handleSelect = (stop: Stop) => {
    onChange(stop.id)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="stop-filter__searchable-select" ref={containerRef}>
      <span className="stop-filter__range-label">{label}</span>
      <button
        type="button"
        className={`stop-filter__searchable-trigger${isOpen ? ' stop-filter__searchable-trigger--open' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <span className={selectedStop ? '' : 'stop-filter__placeholder'}>
          {selectedStop?.name ?? placeholder}
        </span>
        <ChevronDown size={16} className={`stop-filter__chevron ${isOpen ? 'stop-filter__chevron--open' : ''}`} />
      </button>
      {isOpen && (
        <div className="stop-filter__searchable-dropdown">
          <div className="stop-filter__searchable-search">
            <Search size={14} />
            <input
              ref={inputRef}
              type="text"
              className="stop-filter__searchable-input"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="stop-filter__searchable-list">
            {filteredStops.length === 0 ? (
              <li className="stop-filter__searchable-empty">—</li>
            ) : (
              filteredStops.map((stop) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    className={`stop-filter__searchable-option ${stop.id === value ? 'stop-filter__searchable-option--selected' : ''}`}
                    onClick={() => handleSelect(stop)}
                  >
                    <span className="stop-filter__stop-index">{stops.indexOf(stop) + 1}</span>
                    <span>{stop.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
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
  }, [buildStopOrder, route1Schedule, route2Schedule, route3Schedule, routeX2Schedule, routeE2Schedule, routeX3Schedule])

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

  const handleFromChange = (id: number | null) => {
    setSelectedStopRouteRange(id, selectedStopRouteToId)
  }

  const handleToChange = (id: number | null) => {
    setSelectedStopRouteRange(selectedStopRouteFromId, id)
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
        <span>{t.busStops}</span>
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

          {/* Route list - only show when no route is selected */}
          {!selectedStopRoute && (
            <div className="stop-filter__routes">
              <div className="stop-filter__section-label">{t.filterByRoute}</div>
              {isLoading ? (
                <div className="stop-filter__loading">{t.loading}</div>
              ) : (
                KNOWN_ROUTES.map((routeId) => {
                  const stops = routeStopsById.get(routeId) ?? []
                  const isDisabled = stops.length === 0
                  return (
                    <button
                      key={routeId}
                      className="stop-filter__route-btn"
                      style={{ '--route-color': getRouteColor(routeId) } as React.CSSProperties}
                      onClick={() => handleRouteSelect(routeId)}
                      disabled={isDisabled}
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
            </div>
          )}

          {/* Selected route view - show when a route is selected */}
          {selectedStopRoute && selectedRouteStops.length > 0 && (
            <div className="stop-filter__selected-route">
              <div 
                className="stop-filter__route-btn stop-filter__route-btn--active"
                style={{ '--route-color': getRouteColor(selectedStopRoute) } as React.CSSProperties}
              >
                <span className="stop-filter__route-badge">
                  <Route size={14} />
                  <span>{selectedStopRoute}</span>
                </span>
                <span className="stop-filter__route-text">
                  <span className="stop-filter__route-title">{t.route} {selectedStopRoute}</span>
                  <span className="stop-filter__route-subtitle">
                    {selectedRouteStops.length} {t.busStops}
                  </span>
                </span>
              </div>

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

              {selectedStopRouteTripEnabled && selectedRouteStops.length > 1 && (
                <div className="stop-filter__range">
                  <SearchableStopSelect
                    stops={selectedRouteStops}
                    value={selectedStopRouteFromId}
                    onChange={handleFromChange}
                    placeholder={t.chooseStop}
                    label={t.fromStop}
                  />
                  <SearchableStopSelect
                    stops={selectedRouteStops}
                    value={selectedStopRouteToId}
                    onChange={handleToChange}
                    placeholder={t.chooseStop}
                    label={t.toStop}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
