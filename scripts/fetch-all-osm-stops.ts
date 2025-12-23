#!/usr/bin/env bun
/**
 * Fetch All OSM Bus Stops in Nuuk
 * 
 * Queries OpenStreetMap Overpass API for all bus stops in Nuuk
 * and creates a comprehensive stops database.
 * 
 * Usage:
 *   bun run scripts/fetch-all-osm-stops.ts
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get directory path (works in both Node and Bun)
const __dirname = dirname(fileURLToPath(import.meta.url))

const OUTPUT_DERIVED = join(__dirname, '../public/data/stops-derived.json')
const OUTPUT_GEOJSON = join(__dirname, '../public/data/stops.geojson')

// Nuuk bounding box
const NUUK_BBOX = {
  south: 64.15,
  west: -51.80,
  north: 64.22,
  east: -51.65
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

// Interchange stops (main terminal) - highest priority
const INTERCHANGE_STOP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

interface OSMNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: {
    name?: string
    ref?: string
    [key: string]: string | undefined
  }
}

interface OverpassResponse {
  elements: OSMNode[]
}

interface DerivedStop {
  id: number
  name: string
  originalName: string
  firstSeenAt: string
  lastSeenAt: string
  seenCount: number
  priorityScore: number
}

interface StopsDatabase {
  version: number
  generatedAt: string
  totalCollectionRuns: number
  stops: DerivedStop[]
}

interface GeocodedStop {
  type: 'Feature'
  properties: {
    id: number
    name: string
    osmId: number | null
    osmName: string | null
    matchScore: number
    matchMethod: 'exact' | 'fuzzy' | 'manual' | 'unmatched' | 'osm-direct'
    seenCount: number
    priorityScore: number
    firstSeenAt: string
    lastSeenAt: string
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
}

interface StopsGeoJSON {
  type: 'FeatureCollection'
  generatedAt: string
  matchStats: {
    total: number
    matched: number
    unmatched: number
    coveragePercent: number
  }
  features: GeocodedStop[]
}

/**
 * Query Overpass API for all bus stops in Nuuk
 */
async function fetchAllOSMStops(retries = 3): Promise<OSMNode[]> {
  const query = `
    [out:json][timeout:90];
    (
      node["highway"="bus_stop"](${NUUK_BBOX.south},${NUUK_BBOX.west},${NUUK_BBOX.north},${NUUK_BBOX.east});
      node["public_transport"="platform"]["bus"="yes"](${NUUK_BBOX.south},${NUUK_BBOX.west},${NUUK_BBOX.north},${NUUK_BBOX.east});
      node["public_transport"="stop_position"]["bus"="yes"](${NUUK_BBOX.south},${NUUK_BBOX.west},${NUUK_BBOX.north},${NUUK_BBOX.east});
    );
    out body;
  `

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`Querying Overpass API... (attempt ${attempt}/${retries})`)
    
    try {
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
      })

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as OverpassResponse
      return data.elements.filter(el => el.type === 'node' && el.tags?.name)
    } catch (error) {
      console.warn(`  Attempt ${attempt} failed:`, error instanceof Error ? error.message : error)
      if (attempt < retries) {
        console.log(`  Retrying in 10 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
      } else {
        throw error
      }
    }
  }
  
  throw new Error('All retry attempts failed')
}

/**
 * Calculate priority score
 */
function calculatePriorityScore(stopId: number, seenCount: number): number {
  if (INTERCHANGE_STOP_IDS.includes(stopId)) {
    return Number.MAX_SAFE_INTEGER
  }
  return seenCount
}

async function main() {
  console.log('=== Fetching All OSM Bus Stops in Nuuk ===\n')

  // Fetch all OSM stops
  const osmStops = await fetchAllOSMStops()
  console.log(`\nFound ${osmStops.length} named bus stops in OSM`)

  // De-duplicate by name (some stops have multiple nodes)
  const uniqueStops = new Map<string, OSMNode>()
  for (const stop of osmStops) {
    const name = stop.tags?.name || ''
    if (!uniqueStops.has(name)) {
      uniqueStops.set(name, stop)
    }
  }
  console.log(`Unique stop names: ${uniqueStops.size}`)

  const now = new Date().toISOString()
  
  // Create derived stops database
  const derivedStops: DerivedStop[] = []
  let idCounter = 0
  
  for (const [name] of uniqueStops) {
    idCounter++
    const stopId = 100 + idCounter // Start from 100 to avoid Ridango ID conflicts
    
    derivedStops.push({
      id: stopId,
      name,
      originalName: name,
      firstSeenAt: now,
      lastSeenAt: now,
      seenCount: 1,
      priorityScore: calculatePriorityScore(stopId, 1)
    })
  }

  // Sort by name for readability
  derivedStops.sort((a, b) => a.name.localeCompare(b.name))

  const derivedDb: StopsDatabase = {
    version: 1,
    generatedAt: now,
    totalCollectionRuns: 1,
    stops: derivedStops
  }

  // Create GeoJSON with coordinates
  const features: GeocodedStop[] = []
  idCounter = 0
  
  for (const [name, stop] of uniqueStops) {
    idCounter++
    const stopId = 100 + idCounter
    
    features.push({
      type: 'Feature',
      properties: {
        id: stopId,
        name,
        osmId: stop.id,
        osmName: name,
        matchScore: 1,
        matchMethod: 'osm-direct',
        seenCount: 1,
        priorityScore: calculatePriorityScore(stopId, 1),
        firstSeenAt: now,
        lastSeenAt: now
      },
      geometry: {
        type: 'Point',
        coordinates: [stop.lon, stop.lat]
      }
    })
  }

  // Sort by name
  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

  const geojson: StopsGeoJSON = {
    type: 'FeatureCollection',
    generatedAt: now,
    matchStats: {
      total: features.length,
      matched: features.length,
      unmatched: 0,
      coveragePercent: 100
    },
    features
  }

  // Save files
  writeFileSync(OUTPUT_DERIVED, JSON.stringify(derivedDb, null, 2), 'utf-8')
  console.log(`\nSaved ${derivedStops.length} stops to ${OUTPUT_DERIVED}`)

  writeFileSync(OUTPUT_GEOJSON, JSON.stringify(geojson, null, 2), 'utf-8')
  console.log(`Saved ${features.length} geocoded stops to ${OUTPUT_GEOJSON}`)

  // Print all stops
  console.log('\n=== All Bus Stops ===')
  for (const stop of features) {
    const { id, name, osmId } = stop.properties
    const [lon, lat] = stop.geometry.coordinates
    console.log(`  [${id}] ${name} (OSM: ${osmId}) @ ${lat.toFixed(5)}, ${lon.toFixed(5)}`)
  }

  console.log('\nDone!')
}

main().catch(console.error)
