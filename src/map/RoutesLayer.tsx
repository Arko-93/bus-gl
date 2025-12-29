// src/map/RoutesLayer.tsx
// Optional layer for bus routes (behind feature flag)

import { useEffect } from 'react'
import { GeoJSON } from 'react-leaflet'
import { useResolvedTheme } from '../hooks/useResolvedTheme'
import { getRouteLineColor } from '../data/routeColors'
import { useRoutesData, type RouteFeature } from '../data/useStopsData'

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
  const { data: routesData, error } = useRoutesData()
  const resolvedTheme = useResolvedTheme()

  useEffect(() => {
    if (error) {
      console.warn('Failed to load routes layer:', error)
    }
  }, [error])

  // Compute whether to show outline (dormant by default)
  const showOutline = (() => {
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
  })()

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
            color: getRouteLineColor(props?.route || ''),
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
