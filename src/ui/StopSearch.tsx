// src/ui/StopSearch.tsx
// Stop search input using Fuse.js (works with stops.geojson fixture)

import { useState, useEffect, useMemo, useRef } from 'react'
import Fuse from 'fuse.js'

interface Stop {
  id: string
  name: string
  lat: number
  lon: number
}

export default function StopSearch() {
  const [stops, setStops] = useState<Stop[]>([])
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load stops from GeoJSON
  useEffect(() => {
    fetch('/data/stops.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Stops data not found')
        return res.json()
      })
      .then((geojson) => {
        const parsed: Stop[] = geojson.features.map((feature: {
          properties: { name: string; id?: string }
          geometry: { coordinates: [number, number] }
        }) => ({
          id: feature.properties.id || feature.properties.name,
          name: feature.properties.name,
          lon: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
        }))
        setStops(parsed)
      })
      .catch((err) => {
        console.warn('Failed to load stops for search:', err)
      })
  }, [])

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
    if (query.length < 2) return []
    return fuse.search(query).slice(0, 5).map((r) => r.item)
  }, [query, fuse])

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
    console.log('Selected stop:', stop)
    setQuery(stop.name)
    setIsOpen(false)
  }

  return (
    <div className="stop-search">
      <input
        ref={inputRef}
        type="text"
        className="stop-search__input"
        placeholder="Search stops..."
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
              <span className="stop-search__icon">🚏</span>
              {stop.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
