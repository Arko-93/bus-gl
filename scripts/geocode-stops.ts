#!/usr/bin/env bun
/**
 * OSM Geocoding Script (Stage A)
 * 
 * Queries OpenStreetMap Overpass API for bus stops in Nuuk, then fuzzy matches
 * them against our derived stops database using Fuse.js.
 * 
 * Usage:
 *   bun run scripts/geocode-stops.ts
 * 
 * Input:
 *   public/data/stops-derived.json (from collect-stops.ts)
 * 
 * Output:
 *   public/data/stops.geojson
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fuse from 'fuse.js'

// Get directory path (works in both Node and Bun)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Paths
const DERIVED_STOPS_PATH = join(__dirname, '../public/data/stops-derived.json')
const OUTPUT_PATH = join(__dirname, '../public/data/stops.geojson')

// Nuuk bounding box (approximate)
const NUUK_BBOX = {
  south: 64.15,
  west: -51.80,
  north: 64.22,
  east: -51.65
}

// Overpass API endpoint
const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

/**
 * Types
 */
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

interface OSMNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: {
    name?: string
    [key: string]: string | undefined
  }
}

interface OverpassResponse {
  elements: OSMNode[]
}

interface GeocodedStop {
  type: 'Feature'
  properties: {
    id: number
    name: string
    osmId: number | null
    osmName: string | null
    matchScore: number      // 0-1, higher is better match
    matchMethod: 'exact' | 'fuzzy' | 'manual' | 'unmatched'
    seenCount: number
    priorityScore: number
    firstSeenAt: string
    lastSeenAt: string
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number] | null  // [lon, lat] or null if unmatched
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
 * Query Overpass API for bus stops in Nuuk with retry logic
 */
async function fetchOSMBusStops(retries = 3): Promise<OSMNode[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["highway"="bus_stop"](${NUUK_BBOX.south},${NUUK_BBOX.west},${NUUK_BBOX.north},${NUUK_BBOX.east});
      node["public_transport"="platform"]["bus"="yes"](${NUUK_BBOX.south},${NUUK_BBOX.west},${NUUK_BBOX.north},${NUUK_BBOX.east});
      node["public_transport"="stop_position"]["bus"="yes"](${NUUK_BBOX.south},${NUUK_BBOX.west},${NUUK_BBOX.north},${NUUK_BBOX.east});
    );
    out body;
  `

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`Querying Overpass API for bus stops in Nuuk... (attempt ${attempt}/${retries})`)
    
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
      return data.elements.filter(el => el.type === 'node')
    } catch (error) {
      console.warn(`  Attempt ${attempt} failed:`, error instanceof Error ? error.message : error)
      if (attempt < retries) {
        console.log(`  Retrying in 5 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else {
        throw error
      }
    }
  }
  
  throw new Error('All retry attempts failed')
}

/**
 * Normalize stop name for matching (lowercase, remove diacritics, etc.)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match derived stops against OSM stops using Fuse.js
 */
function matchStops(
  derivedStops: DerivedStop[],
  osmStops: OSMNode[]
): GeocodedStop[] {
  // Filter OSM stops that have names
  const namedOSMStops = osmStops.filter(s => s.tags?.name)
  
  console.log(`Found ${osmStops.length} OSM bus stops (${namedOSMStops.length} with names)`)

  // Set up Fuse.js for fuzzy matching
  const fuse = new Fuse(namedOSMStops, {
    keys: ['tags.name'],
    threshold: 0.4,         // 0 = perfect match, 1 = match anything
    includeScore: true,
    ignoreLocation: true,
    getFn: (obj, path) => {
      const value = Fuse.config.getFn(obj, path)
      if (typeof value === 'string') {
        return normalizeName(value)
      }
      return value
    }
  })

  const geocodedStops: GeocodedStop[] = []

  for (const derivedStop of derivedStops) {
    // Try exact match first
    const normalizedDerived = normalizeName(derivedStop.name)
    let matchedOSM: OSMNode | null = null
    let matchScore = 0
    let matchMethod: 'exact' | 'fuzzy' | 'unmatched' = 'unmatched'

    // Exact match (normalized)
    const exactMatch = namedOSMStops.find(
      osm => normalizeName(osm.tags?.name || '') === normalizedDerived
    )

    if (exactMatch) {
      matchedOSM = exactMatch
      matchScore = 1.0
      matchMethod = 'exact'
    } else {
      // Fuzzy match
      const results = fuse.search(normalizedDerived)
      if (results.length > 0 && results[0].score !== undefined) {
        const bestMatch = results[0]
        const fuseScore = bestMatch.score ?? 1
        // Convert Fuse score (0 = perfect) to our score (1 = perfect)
        matchScore = 1 - fuseScore
        
        // Only accept if score is reasonable (> 0.6 means < 0.4 Fuse score)
        if (matchScore >= 0.6) {
          matchedOSM = bestMatch.item
          matchMethod = 'fuzzy'
        }
      }
    }

    const feature: GeocodedStop = {
      type: 'Feature',
      properties: {
        id: derivedStop.id,
        name: derivedStop.name,
        osmId: matchedOSM?.id ?? null,
        osmName: matchedOSM?.tags?.name ?? null,
        matchScore: Math.round(matchScore * 100) / 100,
        matchMethod,
        seenCount: derivedStop.seenCount,
        priorityScore: derivedStop.priorityScore,
        firstSeenAt: derivedStop.firstSeenAt,
        lastSeenAt: derivedStop.lastSeenAt
      },
      geometry: {
        type: 'Point',
        coordinates: matchedOSM ? [matchedOSM.lon, matchedOSM.lat] : null
      }
    }

    geocodedStops.push(feature)
  }

  return geocodedStops
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('=== OSM Geocoding (Stage A) ===\n')

  // Load derived stops
  if (!existsSync(DERIVED_STOPS_PATH)) {
    console.error('Error: stops-derived.json not found. Run collect-stops.ts first.')
    process.exit(1)
  }

  const derivedData: StopsDatabase = JSON.parse(readFileSync(DERIVED_STOPS_PATH, 'utf-8'))
  console.log(`Loaded ${derivedData.stops.length} derived stops`)

  if (derivedData.stops.length === 0) {
    console.error('Error: No stops in database. Run collect-stops.ts to gather stops first.')
    process.exit(1)
  }

  // Fetch OSM bus stops
  const osmStops = await fetchOSMBusStops()

  // Match stops
  const geocodedStops = matchStops(derivedData.stops, osmStops)

  // Calculate stats
  const matched = geocodedStops.filter(s => s.properties.matchMethod !== 'unmatched').length
  const total = geocodedStops.length
  const coveragePercent = Math.round((matched / total) * 100)

  console.log(`\nMatch Results:`)
  console.log(`  Total:     ${total}`)
  console.log(`  Matched:   ${matched}`)
  console.log(`  Unmatched: ${total - matched}`)
  console.log(`  Coverage:  ${coveragePercent}%`)

  // Create GeoJSON output
  const geojson: StopsGeoJSON = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    matchStats: {
      total,
      matched,
      unmatched: total - matched,
      coveragePercent
    },
    features: geocodedStops
  }

  // Save to file
  writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf-8')
  console.log(`\nSaved to ${OUTPUT_PATH}`)

  // Show unmatched stops for manual review
  const unmatched = geocodedStops.filter(s => s.properties.matchMethod === 'unmatched')
  if (unmatched.length > 0) {
    console.log('\nUnmatched stops (need manual geocoding):')
    for (const stop of unmatched) {
      console.log(`  - [${stop.properties.id}] ${stop.properties.name}`)
    }
  }

  // Check if we need Stage C (PDF georeferencing)
  // Threshold: < 80% coverage OR > 3 mismatches in top 20 priority stops
  const top20 = geocodedStops.slice(0, 20)
  const top20Unmatched = top20.filter(s => s.properties.matchMethod === 'unmatched').length
  
  if (coveragePercent < 80 || top20Unmatched > 3) {
    console.log('\n⚠️  Coverage is insufficient. Consider Stage C (PDF georeferencing).')
    console.log(`   Coverage: ${coveragePercent}% (threshold: 80%)`)
    console.log(`   Top 20 unmatched: ${top20Unmatched} (threshold: 3)`)
  } else {
    console.log('\n✓ Coverage is sufficient. Stage A complete.')
  }
}

main().catch(console.error)
