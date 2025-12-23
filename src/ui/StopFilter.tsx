// src/ui/StopFilter.tsx
// Stop filter - pill button that opens a dropdown with search and stop selection

import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, X, MapPin } from 'lucide-react'
import Fuse from 'fuse.js'
import { useAppStore } from '../state/appStore'
import { useTranslation, useLocale } from '../i18n/useTranslation'

interface Stop {
  id: number
  name: string
  lat: number
  lon: number
}

export default function StopFilter() {
  const t = useTranslation()
  const { locale } = useLocale()
  const [stops, setStops] = useState<Stop[]>([])
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredStopIds = useAppStore((state) => state.filteredStopIds)
  const filteredStopNames = useAppStore((state) => state.filteredStopNames)
  const addStopFilter = useAppStore((state) => state.addStopFilter)
  const removeStopFilter = useAppStore((state) => state.removeStopFilter)
  const clearStopFilters = useAppStore((state) => state.clearStopFilters)

  const hasFilters = filteredStopIds.size > 0
  const isLoading = stops.length === 0

  // Load stops from GeoJSON
  useEffect(() => {
    fetch('/data/stops.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Stops data not found')
        return res.json()
      })
      .then((geojson) => {
        const parsed: Stop[] = geojson.features
          .filter((feature: { geometry: { coordinates: [number, number] | null } }) => 
            feature.geometry.coordinates !== null
          )
          .map((feature: {
            properties: { name: string; id: number }
            geometry: { coordinates: [number, number] }
          }) => ({
            id: feature.properties.id,
            name: feature.properties.name,
            lon: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
          }))
        setStops(parsed)
      })
      .catch((err) => {
        console.warn('Failed to load stops for filter:', err)
      })
  }, [])

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    if (stops.length === 0) return null
    return new Fuse(stops, {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true,
    })
  }, [stops])

  // Compute search results
  const searchResults = useMemo(() => {
    if (!fuse || query.length < 1) {
      // Show all stops when no query, excluding already selected
      return stops
        .filter((stop) => !filteredStopIds.has(stop.id))
        .slice(0, 8)
    }
    return fuse
      .search(query)
      .slice(0, 8)
      .map((r) => r.item)
      .filter((stop) => !filteredStopIds.has(stop.id))
  }, [query, fuse, filteredStopIds, stops])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleSelectAll = () => {
    // Add all stops to the filter
    stops.forEach((stop) => {
      addStopFilter(stop.id, stop.name)
    })
  }

  const handleRemoveAll = () => {
    clearStopFilters()
  }

  const handleSelect = (stop: Stop) => {
    addStopFilter(stop.id, stop.name)
    setQuery('')
  }

  const handleRemoveTag = (stopId: number) => {
    removeStopFilter(stopId)
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
              {hasFilters ? (
                <button 
                  className="stop-filter__action-btn stop-filter__action-btn--remove"
                  onClick={handleRemoveAll}
                >
                  {t.clearFilters}
                </button>
              ) : (
                <button 
                  className="stop-filter__action-btn"
                  onClick={handleSelectAll}
                  disabled={isLoading}
                >
                  {t.showAllStops}
                </button>
              )}
              <button 
                className="stop-filter__close" 
                onClick={() => { setIsOpen(false); setQuery(''); }}
                aria-label={t.close}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="stop-filter__search-box">
            <Search size={14} className="stop-filter__search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="stop-filter__input"
              placeholder={t.searchStops}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button 
                className="stop-filter__clear-input"
                onClick={() => setQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Selected stops tags */}
          {hasFilters && (
            <div className="stop-filter__tags">
              {Array.from(filteredStopIds).map((stopId) => (
                <span key={stopId} className="stop-filter__tag">
                  <MapPin size={10} />
                  <span className="stop-filter__tag-name">
                    {filteredStopNames.get(stopId) || `Stop ${stopId}`}
                  </span>
                  <button
                    className="stop-filter__tag-remove"
                    onClick={() => handleRemoveTag(stopId)}
                    aria-label={`Remove ${filteredStopNames.get(stopId)}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Results list */}
          <div className="stop-filter__results">
            {isLoading ? (
              <div className="stop-filter__loading">{t.loading}</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((stop) => (
                <button
                  key={stop.id}
                  className="stop-filter__result"
                  onClick={() => handleSelect(stop)}
                >
                  <MapPin size={14} />
                  <span>{stop.name}</span>
                </button>
              ))
            ) : (
              <div className="stop-filter__empty">
                {query ? t.noBusesAtStop : t.loading}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
