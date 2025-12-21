// src/map/RoutesLayer.tsx
// Optional layer for bus routes (behind feature flag)

import { useEffect, useState, useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import { useResolvedTheme } from '../hooks/useResolvedTheme'

interface RouteFeature {
  type: 'Feature'
  properties: {
    name: string
    route: string
    color?: string
  }
  geometry: {
    type: 'LineString' | 'MultiLineString'
    coordinates: number[][] | number[][][]
  }
}

interface RoutesGeoJSON {
  type: 'FeatureCollection'
  features: RouteFeature[]
}

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

/**
 * Route styling configuration
 * 
 * Outline/casing is a dormant capability for dark mode legibility.
 * To enable: set --route-outline-width to a non-zero value in CSS (e.g., 2px)
 * 
 * Env var alternative: VITE_ROUTE_OUTLINE_WIDTH=2
 */
const ROUTE_WIDTH = 4
const ROUTE_OUTLINE_WIDTH = parseInt(import.meta.env.VITE_ROUTE_OUTLINE_WIDTH || '0', 10)

export default function RoutesLayer() {
  const [routesData, setRoutesData] = useState<RoutesGeoJSON | null>(null)
  const resolvedTheme = useResolvedTheme()

  useEffect(() => {
    fetch('/data/routes.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Routes data not found')
        return res.json()
      })
      .then(setRoutesData)
      .catch((err) => {
        console.warn('Failed to load routes layer:', err)
      })
  }, [])

  // Compute whether to show outline (dormant by default)
  const showOutline = useMemo(() => {
    // Check CSS variable from document
    if (typeof window !== 'undefined') {
      const cssOutlineWidth = getComputedStyle(document.documentElement)
        .getPropertyValue('--route-outline-width')
        .trim()
      if (cssOutlineWidth && cssOutlineWidth !== '0px' && cssOutlineWidth !== '0') {
        return true
      }
    }
    // Fall back to env var
    return ROUTE_OUTLINE_WIDTH > 0
  }, [resolvedTheme]) // Re-check when theme changes

  if (!routesData) return null

  return (
    <>
      {/* Outline layer (casing) - only rendered if outline is enabled */}
      {showOutline && (
        <GeoJSON
          key={`outline-${resolvedTheme}`}
          data={routesData}
          style={() => {
            const outlineWidth = ROUTE_OUTLINE_WIDTH > 0 ? ROUTE_OUTLINE_WIDTH : 2
            return {
              color: resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)',
              weight: ROUTE_WIDTH + outlineWidth * 2,
              opacity: 0.6,
              dashArray: '10, 5',
            }
          }}
        />
      )}
      
      {/* Main route layer */}
      <GeoJSON
        key={`routes-${resolvedTheme}`}
        data={routesData}
        style={(feature) => {
          const props = feature?.properties as RouteFeature['properties']
          return {
            color: props?.color || getRouteColor(props?.route || ''),
            weight: ROUTE_WIDTH,
            opacity: 0.6,
            dashArray: '10, 5',
          }
        }}
        onEachFeature={(feature, layer) => {
          const props = feature.properties as RouteFeature['properties']
          if (props.name) {
            layer.bindTooltip(props.name, {
              permanent: false,
              sticky: true,
            })
          }
        }}
      />
    </>
  )
}
