// src/data/routeColors.ts
// Centralized route color definitions - single source of truth for all route colors

import type { KnownRoute } from './ridangoRealtime'

/**
 * Route color mapping - matches Nuup Bussii official branding
 * 
 * This is the single source of truth for route colors across the app.
 * All UI components should import from here instead of defining their own colors.
 */
export const ROUTE_COLORS: Record<KnownRoute, string> = {
  '1': '#E91E8C',   // Pink/Magenta (Rute 1)
  '2': '#FFD700',   // Yellow (Rute 2) - Nuup Bussii brand color
  '3': '#4CAF50',   // Green (Rute 3)
  'X2': '#808080',  // Gray (Rute X2)
  'E2': '#0066CC',  // Blue (Rute E2)
  'X3': '#00b047',  // Green (Rute X3)
}

/**
 * Route line colors for map paths - slightly adjusted for visibility on map
 * Falls back to ROUTE_COLORS if not specified
 */
export const ROUTE_LINE_COLORS: Partial<Record<KnownRoute, string>> = {
  '2': '#DAA520',   // Goldenrod - darker than brand yellow for path visibility
}

/**
 * Route line colors for dark mode - brighter versions for visibility on dark map
 * Falls back to ROUTE_LINE_COLORS, then ROUTE_COLORS if not specified
 */
export const ROUTE_LINE_COLORS_DARK: Partial<Record<KnownRoute, string>> = {
  'X2': '#d0d0d0',  // Light gray - high contrast on dark background
  'E2': '#7ec8ff',  // Bright sky blue - high contrast on dark background
}

/**
 * Default fallback color for unknown routes
 */
export const DEFAULT_ROUTE_COLOR = '#6b7280'

/**
 * Qatserisut depot - where buses are maintained/stored
 */
export const DEPOT_BOUNDS = {
  minLat: 64.1795,
  maxLat: 64.1825,
  minLon: -51.7200,
  maxLon: -51.7130,
}

export function isAtDepot(lat: number, lon: number): boolean {
  return (
    lat >= DEPOT_BOUNDS.minLat &&
    lat <= DEPOT_BOUNDS.maxLat &&
    lon >= DEPOT_BOUNDS.minLon &&
    lon <= DEPOT_BOUNDS.maxLon
  )
}

/**
 * Get the color for a route by its ID
 * 
 * @param route - Route ID (e.g., '1', '2', 'X2')
 * @returns Hex color string for the route, or gray fallback for unknown routes
 */
export function getRouteColor(route: string): string {
  return ROUTE_COLORS[route as KnownRoute] ?? DEFAULT_ROUTE_COLOR
}

/**
 * Get the line color for a route path on the map
 * Uses dark mode colors when isDark is true, otherwise uses standard colors
 * 
 * @param route - Route ID (e.g., '1', '2', 'X2')
 * @param isDark - Whether to use dark mode colors
 * @returns Hex color string for the route line
 */
export function getRouteLineColor(route: string, isDark = false): string {
  if (isDark) {
    const darkColor = ROUTE_LINE_COLORS_DARK[route as KnownRoute]
    if (darkColor) return darkColor
  }
  return ROUTE_LINE_COLORS[route as KnownRoute] ?? ROUTE_COLORS[route as KnownRoute] ?? DEFAULT_ROUTE_COLOR
}

