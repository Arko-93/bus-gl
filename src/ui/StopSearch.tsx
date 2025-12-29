// src/ui/StopSearch.tsx
// Stop search input using Fuse.js (works with stops.geojson fixture)

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import Fuse from 'fuse.js'
import { useStopsData } from '../data/useStopsData'
import { useTranslation } from '../i18n/useTranslation'

interface Stop {
  id: number
  name: string
  lat: number
  lon: number
}

export default function StopSearch() {
  const { data: stopsData, isLoading } = useStopsData()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const t = useTranslation()

  const stops = useMemo<Stop[]>(() => {
    if (!stopsData) return []
    return stopsData.features.flatMap((feature) => {
      if (!feature.geometry.coordinates) return []
      const [lon, lat] = feature.geometry.coordinates
      return [
        {
          id: feature.properties.id,
          name: feature.properties.name,
          lon,
          lat,
        },
      ]
    })
  }, [stopsData])

  const deferredQuery = useDeferredValue(query)
  const placeholder = isLoading ? t.loading : t.searchStops

  // Initialize Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(stops, {
      keys: ['name'],
      threshold: 0.3,
      includeScore: true,
    })
  }, [stops])

  // Compute search results from query (derived state, no effect needed)
  const searchResults = useMemo(() => {
    if (deferredQuery.length < 2) return []
    return fuse.search(deferredQuery).slice(0, 5).map((r) => r.item)
  }, [deferredQuery, fuse])

  // Derive if dropdown should be shown
  const showDropdown = isOpen && searchResults.length > 0

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (stop: Stop) => {
    // TODO: Pan map to stop location
    setQuery(stop.name)
    setIsOpen(false)
  }

  return (
    <div className="stop-search">
      <input
        ref={inputRef}
        type="text"
        className="stop-search__input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true) // Open dropdown when typing
        }}
        onFocus={() => searchResults.length > 0 && setIsOpen(true)}
      />
      {showDropdown && (
        <div ref={dropdownRef} className="stop-search__dropdown">
          {searchResults.map((stop) => (
            <button
              key={stop.id}
              className="stop-search__result"
              onClick={() => handleSelect(stop)}
            >
              <span className="stop-search__icon"><MapPin size={14} /></span>
              {stop.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
