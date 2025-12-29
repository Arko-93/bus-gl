#!/usr/bin/env bun
/**
 * Rebuild stops.geojson from timecodes CSV files
 * 
 * Extracts stop IDs and names from the timecodes CSV files (source of truth)
 * and matches them with OSM coordinates.
 * 
 * Usage:
 *   bun run scripts/rebuild-stops-from-timecodes.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fuse from 'fuse.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '../public/data')
const OUTPUT_PATH = join(DATA_PATH, 'stops.geojson')

// Nuuk bounding box
const NUUK_BBOX = {
  south: 64.15,
  west: -51.80,
  north: 64.22,
  east: -51.65
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

// Manual coordinates for stops that can't be found in OSM
const MANUAL_COORDINATES: Record<number, [number, number]> = {
  // Format: [longitude, latitude]
  // Add any manually geocoded stops here
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

interface StopInfo {
  id: number
  name: string
}

interface GeocodedStop {
  type: 'Feature'
  properties: {
    id: number
    name: string
    osmId: number | null
    osmName: string | null
    matchScore: number
    matchMethod: 'exact' | 'fuzzy' | 'manual' | 'unmatched'
    seenCount: number
    priorityScore: number
    firstSeenAt: string
    lastSeenAt: string
    source: 'ridango'
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number] | null
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
    ridangoStops: number
    osmOnlyStops: number
    manualStops: number
  }
  features: GeocodedStop[]
}

/**
 * Extract stops from all timecodes CSV files
 */
function extractStopsFromTimecodes(): Map<number, string> {
  const stops = new Map<number, string>()
  
  const files = readdirSync(DATA_PATH).filter(f => f.startsWith('timecodes_bus_') && f.endsWith('.csv'))
  
  for (const file of files) {
    const content = readFileSync(join(DATA_PATH, file), 'utf-8')
    const lines = content.split(/\r?\n/)
    
    for (const line of lines) {
      if (!line.includes('Round trip')) continue
      
      const columns = line.split(',')
      for (const col of columns) {
        const match = col.trim().match(/^(\d+)\.\s*(.+)$/)
        if (match) {
          const id = parseInt(match[1], 10)
          const name = match[2].trim()
          // Keep first occurrence (don't override)
          if (!stops.has(id)) {
            stops.set(id, name)
          }
        }
      }
    }
  }
  
  return stops
}

/**
 * Fetch all OSM stops
 */
async function fetchOSMStops(retries = 3): Promise<OSMNode[]> {
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
        throw new Error(`Overpass API error: ${response.status}`)
      }

      const data = await response.json() as { elements: OSMNode[] }
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
  throw new Error('All attempts failed')
}

/**
 * Normalize name for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('=== Rebuild Stops from Timecodes ===\n')

  // 1. Extract stops from timecodes
  const stopsMap = extractStopsFromTimecodes()
  console.log(`Extracted ${stopsMap.size} stops from timecodes CSVs`)
  
  // Sort by ID for display
  const sortedStops = Array.from(stopsMap.entries()).sort((a, b) => a[0] - b[0])
  console.log('\nStops found:')
  for (const [id, name] of sortedStops) {
    console.log(`  ${id}: ${name}`)
  }

  // 2. Fetch OSM stops
  const osmStops = await fetchOSMStops()
  console.log(`\nFetched ${osmStops.length} OSM bus stops`)

  // De-duplicate OSM by name
  const uniqueOSM = new Map<string, OSMNode>()
  for (const stop of osmStops) {
    const name = stop.tags?.name || ''
    if (!uniqueOSM.has(name)) {
      uniqueOSM.set(name, stop)
    }
  }
  console.log(`Unique OSM stop names: ${uniqueOSM.size}`)

  // 3. Set up fuzzy matching
  const osmArray = Array.from(uniqueOSM.values())
  const fuse = new Fuse(osmArray, {
    keys: ['tags.name'],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    getFn: (obj, path) => {
      const value = Fuse.config.getFn(obj, path)
      return typeof value === 'string' ? normalizeName(value) : value
    }
  })

  const now = new Date().toISOString()
  const features: GeocodedStop[] = []

  // 4. Match each timecodes stop to OSM
  console.log('\n--- Matching stops to OSM ---')
  let matchedCount = 0
  let manualCount = 0
  
  for (const [id, name] of sortedStops) {
    const normalizedName = normalizeName(name)
    
    // Check for manual coordinates first
    if (MANUAL_COORDINATES[id]) {
      console.log(`  [${id}] ${name}: ✓ manual coordinates`)
      manualCount++
      features.push({
        type: 'Feature',
        properties: {
          id,
          name,
          osmId: null,
          osmName: null,
          matchScore: 1,
          matchMethod: 'manual',
          seenCount: 1,
          priorityScore: 1,
          firstSeenAt: now,
          lastSeenAt: now,
          source: 'ridango'
        },
        geometry: {
          type: 'Point',
          coordinates: MANUAL_COORDINATES[id]
        }
      })
      continue
    }
    
    // Try exact match
    let osmMatch: OSMNode | null = null
    let matchScore = 0
    let matchMethod: 'exact' | 'fuzzy' | 'unmatched' = 'unmatched'

    for (const [osmName, osm] of uniqueOSM) {
      if (normalizeName(osmName) === normalizedName) {
        osmMatch = osm
        matchScore = 1
        matchMethod = 'exact'
        break
      }
    }

    // Try fuzzy match
    if (!osmMatch) {
      const results = fuse.search(normalizedName)
      if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.4) {
        osmMatch = results[0].item
        matchScore = 1 - results[0].score
        matchMethod = 'fuzzy'
      }
    }

    if (osmMatch) {
      matchedCount++
      console.log(`  [${id}] ${name}: ✓ ${matchMethod} → ${osmMatch.tags?.name}`)
    } else {
      console.log(`  [${id}] ${name}: ✗ no match`)
    }

    features.push({
      type: 'Feature',
      properties: {
        id,
        name,
        osmId: osmMatch?.id ?? null,
        osmName: osmMatch?.tags?.name ?? null,
        matchScore: Math.round(matchScore * 100) / 100,
        matchMethod,
        seenCount: 1,
        priorityScore: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        source: 'ridango'
      },
      geometry: {
        type: 'Point',
        coordinates: osmMatch ? [osmMatch.lon, osmMatch.lat] : null
      }
    })
  }

  // Sort by ID
  features.sort((a, b) => a.properties.id - b.properties.id)

  // Stats
  const totalMatched = features.filter(f => f.geometry.coordinates !== null).length

  const geojson: StopsGeoJSON = {
    type: 'FeatureCollection',
    generatedAt: now,
    matchStats: {
      total: features.length,
      matched: totalMatched,
      unmatched: features.length - totalMatched,
      coveragePercent: Math.round((totalMatched / features.length) * 100),
      ridangoStops: features.length,
      osmOnlyStops: 0,
      manualStops: manualCount
    },
    features
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf-8')

  console.log('\n=== Summary ===')
  console.log(`Total stops: ${features.length}`)
  console.log(`  Matched to OSM: ${matchedCount}`)
  console.log(`  Manual coordinates: ${manualCount}`)
  console.log(`  Unmatched: ${features.length - matchedCount - manualCount}`)
  console.log(`Coverage: ${geojson.matchStats.coveragePercent}%`)
  console.log(`\nSaved to ${OUTPUT_PATH}`)
  
  // List unmatched stops for manual review
  const unmatched = features.filter(f => f.geometry.coordinates === null)
  if (unmatched.length > 0) {
    console.log('\n=== Unmatched stops (need manual coordinates) ===')
    for (const f of unmatched) {
      console.log(`  ${f.properties.id}: ${f.properties.name}`)
    }
  }
}

main().catch(console.error)
