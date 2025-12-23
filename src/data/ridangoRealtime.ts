// src/data/ridangoRealtime.ts
// Types and normalization for the Ridango realtime feed

import { z } from 'zod'

/**
 * Raw vehicle data from the pilet.ee API
 * Note: The endpoint path contains "gotlandpublicrealtime" but this is a legacy/reused
 * endpoint name. The actual data is determined by the org_id parameter.
 * 
 * Schema is intentionally flexible to handle varying field types from the API.
 */
export const RawVehicleSchema = z.object({
  // device_id can be string or number
  device_id: z.union([z.string(), z.number()]).optional().transform(v => v?.toString()),
  current_gps_latitude: z.union([z.string(), z.number()]).transform(v => Number(v)),
  current_gps_longitude: z.union([z.string(), z.number()]).transform(v => Number(v)),
  route_short_name: z.union([z.string(), z.number()]).optional().transform(v => v?.toString() ?? ''),
  route_long_name: z.union([z.string(), z.number()]).optional().transform(v => v?.toString() ?? ''),
  updated_at: z.string().optional().nullable(),
  stop_name: z.union([z.string(), z.null()]).optional().transform(v => v ?? ''),
  next_stop_name: z.union([z.string(), z.null()]).optional().transform(v => v ?? ''),
  current_bus_speed: z.union([z.string(), z.number(), z.null()]).optional().transform(v => v ? Number(v) : 0),
  at_stop: z.union([z.string(), z.boolean(), z.null()]).optional().transform(v => v === 'true' || v === true),
  trip_headsign: z.union([z.string(), z.null()]).optional().transform(v => v ?? ''),
  // Additional fields for stop tracking
  location_id: z.union([z.string(), z.null()]).optional().transform(v => v ?? ''),
  trip_id: z.union([z.string(), z.number(), z.null()]).optional().transform(v => v?.toString() ?? ''),
  stop_departure_time: z.union([z.string(), z.null()]).optional().transform(v => v ?? ''),
}).passthrough() // Allow additional unknown fields without failing

export type RawVehicle = z.infer<typeof RawVehicleSchema>

/**
 * Parsed stop field result
 * The API returns stop names in format "ID: Name" (e.g., "54: Atuarfik Hans Lynge")
 */
export interface ParsedStop {
  id: number
  name: string
}

/**
 * Parse a stop field from the API format "ID: Name" to separate id and name
 * @param raw - Raw stop string from API (e.g., "54: Atuarfik Hans Lynge")
 * @returns Parsed stop with id and name, or null if format doesn't match
 */
export function parseStopField(raw: string | null | undefined): ParsedStop | null {
  if (!raw || typeof raw !== 'string') return null
  
  const match = raw.match(/^(\d+):\s*(.+)$/)
  if (!match) return null
  
  const id = parseInt(match[1], 10)
  const name = match[2].trim()
  
  if (isNaN(id) || !name) return null
  
  return { id, name }
}

/**
 * Normalized vehicle model for the app
 */
export interface Vehicle {
  id: string
  route: string
  routeLongName: string
  lat: number
  lon: number
  updatedAtMs: number
  speed: number
  atStop: boolean
  
  // Raw stop fields as returned by API (format: "ID: Name")
  stopNameRaw: string
  nextStopNameRaw: string
  headsignRaw: string
  
  // Parsed stop info (null if parsing failed)
  stopId: number | null
  stopName: string | null
  nextStopId: number | null
  nextStopName: string | null
  
  // Vehicle identifiers
  busId: string          // location_id from API (e.g., "NK-28")
  deviceId: string       // device_id from API
  tripId: string         // trip_id from API
  
  // Legacy fields for backward compatibility
  /** @deprecated Use stopNameRaw instead */
  headsign: string
  
  isStale: boolean
}

/**
 * Parse ISO timestamp to milliseconds
 */
function parseTimestamp(isoString: string | undefined | null): number {
  if (!isoString) return 0
  const parsed = Date.parse(isoString)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Check if vehicle data is stale (> 120 seconds old)
 */
function isVehicleStale(updatedAtMs: number): boolean {
  if (updatedAtMs === 0) return true
  return Date.now() - updatedAtMs > 120000 // 2 minutes
}

/**
 * Normalize raw API response to Vehicle array
 */
export function normalizeVehicles(rawData: Record<string, unknown>): Vehicle[] {
  const vehicles: Vehicle[] = []

  for (const [id, rawVehicle] of Object.entries(rawData)) {
    try {
      const parsed = RawVehicleSchema.parse(rawVehicle)
      const updatedAtMs = parseTimestamp(parsed.updated_at)
      const stableId = parsed.location_id || parsed.device_id || parsed.trip_id || id
      
      // Parse stop fields
      const currentStop = parseStopField(parsed.stop_name)
      const nextStop = parseStopField(parsed.next_stop_name)
      
      vehicles.push({
        id: stableId,
        route: parsed.route_short_name || 'N/A',
        routeLongName: parsed.route_long_name,
        lat: parsed.current_gps_latitude,
        lon: parsed.current_gps_longitude,
        updatedAtMs,
        speed: parsed.current_bus_speed,
        atStop: parsed.at_stop,
        
        // Raw fields
        stopNameRaw: parsed.stop_name,
        nextStopNameRaw: parsed.next_stop_name,
        headsignRaw: parsed.trip_headsign,
        
        // Parsed stop info
        stopId: currentStop?.id ?? null,
        stopName: currentStop?.name ?? null,
        nextStopId: nextStop?.id ?? null,
        nextStopName: nextStop?.name ?? null,
        
        // Vehicle identifiers
        busId: parsed.location_id,
        deviceId: parsed.device_id ?? '',
        tripId: parsed.trip_id,
        
        // Legacy
        headsign: parsed.trip_headsign,
        
        isStale: isVehicleStale(updatedAtMs),
      })
    } catch (error) {
      console.warn(`Failed to parse vehicle ${id}:`, error)
    }
  }

  return vehicles
}

/**
 * Known routes for the route filter
 * Matches Nuup Bussii official route map
 */
export const KNOWN_ROUTES = ['1', '2', '3', 'X2', 'E2', 'X3'] as const
export type KnownRoute = typeof KNOWN_ROUTES[number]
