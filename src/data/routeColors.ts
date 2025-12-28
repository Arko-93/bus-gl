// src/data/routeColors.ts
// Centralized route color definitions - single source of truth for all route colors

import { KNOWN_ROUTES, type KnownRoute } from './ridangoRealtime'

/**
 * Route color mapping - matches Nuup Bussii official branding
 * 
 * This is the single source of truth for route colors across the app.
 * All UI components should import from here instead of defining their own colors.
 */
export const ROUTE_COLORS: Record<KnownRoute, string> = {
  '1': '#E91E8C',   // Pink/Magenta (Rute 1)
  '2': '#FFD700',   // Yellow (Rute 2)
  '3': '#4CAF50',   // Green (Rute 3)
  'X2': '#808080',  // Gray (Rute X2)
  'E2': '#0066CC',  // Blue (Rute E2)
  'X3': '#00b047',  // Green (Rute X3)
}

/**
 * Default fallback color for unknown routes
 */
export const DEFAULT_ROUTE_COLOR = '#6b7280'

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
 * Check if a route ID is a known route
 */
export function isKnownRoute(route: string): route is KnownRoute {
  return KNOWN_ROUTES.includes(route as KnownRoute)
}
