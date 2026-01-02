import { useEffect, useMemo } from 'react'
import { MapRoute } from '@/components/ui/map'
import { useResolvedTheme } from '../hooks/useResolvedTheme'
import { getRouteLineColor } from '../data/routeColors'
import { useRoutesData } from '../data/useStopsData'

const ROUTE_WIDTH = 4
const ROUTE_OUTLINE_WIDTH = parseInt(import.meta.env.VITE_ROUTE_OUTLINE_WIDTH || '0', 10)

export default function RoutesLayerMapLibre() {
  const { data: routesData, error } = useRoutesData()
  const resolvedTheme = useResolvedTheme()

  useEffect(() => {
    if (error) {
      console.warn('Failed to load routes layer:', error)
    }
  }, [error])

  const showOutline = (() => {
    if (typeof window !== 'undefined') {
      const cssOutlineWidth = getComputedStyle(document.documentElement)
        .getPropertyValue('--route-outline-width')
        .trim()
      if (cssOutlineWidth && cssOutlineWidth !== '0px' && cssOutlineWidth !== '0') {
        return true
      }
    }
    return ROUTE_OUTLINE_WIDTH > 0
  })()

  const routeSegments = useMemo(() => {
    if (!routesData) return [] as Array<{ route: string; coords: [number, number][] }>
    return routesData.features.flatMap((feature) => {
      const route = feature.properties.route
      if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates.map((coord) => [coord[0], coord[1]] as [number, number])
        return [{ route, coords }]
      }
      if (feature.geometry.type === 'MultiLineString') {
        return feature.geometry.coordinates.map((line) => ({
          route,
          coords: line.map((coord) => [coord[0], coord[1]] as [number, number]),
        }))
      }
      return []
    })
  }, [routesData])

  if (!routesData) return null

  return (
    <>
      {showOutline &&
        routeSegments.map((segment, index) => (
          <MapRoute
            key={`outline-${segment.route}-${index}`}
            coordinates={segment.coords}
            color={resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)'}
            width={ROUTE_WIDTH + (ROUTE_OUTLINE_WIDTH > 0 ? ROUTE_OUTLINE_WIDTH : 2) * 2}
            opacity={0.6}
            dashArray={[10, 5]}
          />
        ))}
      {routeSegments.map((segment, index) => (
        <MapRoute
          key={`routes-${segment.route}-${index}`}
          coordinates={segment.coords}
          color={getRouteLineColor(segment.route || '')}
          width={ROUTE_WIDTH}
          opacity={0.6}
          dashArray={[10, 5]}
        />
      ))}
    </>
  )
}
