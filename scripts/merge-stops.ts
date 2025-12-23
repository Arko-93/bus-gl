#!/usr/bin/env bun
/**
 * Merge Ridango Stops with OSM Stops
 * 
 * Combines stops discovered from the realtime API (with their actual IDs)
 * with OSM bus stop data (for geocoding and undiscovered stops).
 * 
 * Priority:
 * 1. Ridango-derived stops keep their real IDs (1-99 range)
 * 2. OSM-only stops get IDs starting from 100
 * 
 * Usage:
 *   bun run scripts/merge-stops.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fuse from 'fuse.js'

// Get directory path (works in both Node and Bun)
const __dirname = dirname(fileURLToPath(import.meta.url))

const DERIVED_PATH = join(__dirname, '../public/data/stops-derived.json')
const OUTPUT_PATH = join(__dirname, '../public/data/stops.geojson')

// Nuuk bounding box
const NUUK_BBOX = {
  south: 64.15,
  west: -51.80,
  north: 64.22,
  east: -51.65
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

// Interchange stops - highest priority
const INTERCHANGE_STOP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

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
    matchMethod: 'exact' | 'fuzzy' | 'manual' | 'unmatched' | 'osm-only'
    seenCount: number
    priorityScore: number
    firstSeenAt: string
    lastSeenAt: string
    source: 'ridango' | 'osm'
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
  }
  features: GeocodedStop[]
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

/**
 * Calculate priority score
 */
function getPriorityScore(id: number, seenCount: number): number {
  if (INTERCHANGE_STOP_IDS.includes(id)) {
    return Number.MAX_SAFE_INTEGER
  }
  return seenCount
}

async function main() {
  console.log('=== Merge Ridango + OSM Stops ===\n')

  // Load existing Ridango-derived stops (if any)
  let ridangoStops: DerivedStop[] = []
  if (existsSync(DERIVED_PATH)) {
    const data: StopsDatabase = JSON.parse(readFileSync(DERIVED_PATH, 'utf-8'))
    ridangoStops = data.stops.filter(s => s.id < 100) // Only real Ridango IDs
    console.log(`Loaded ${ridangoStops.length} Ridango-derived stops`)
  }

  // Fetch all OSM stops
  const osmStops = await fetchOSMStops()
  console.log(`Fetched ${osmStops.length} OSM bus stops`)

  // De-duplicate OSM by name
  const uniqueOSM = new Map<string, OSMNode>()
  for (const stop of osmStops) {
    const name = stop.tags?.name || ''
    if (!uniqueOSM.has(name)) {
      uniqueOSM.set(name, stop)
    }
  }
  console.log(`Unique OSM stop names: ${uniqueOSM.size}`)

  // Set up fuzzy matching
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
  const matchedOSMIds = new Set<number>()

  // 1. Process Ridango stops and match to OSM
  console.log('\n--- Matching Ridango stops to OSM ---')
  for (const ridStop of ridangoStops) {
    const normalizedName = normalizeName(ridStop.name)
    
    // Try exact match
    let osmMatch: OSMNode | null = null
    let matchScore = 0
    let matchMethod: 'exact' | 'fuzzy' | 'unmatched' = 'unmatched'

    for (const [name, osm] of uniqueOSM) {
      if (normalizeName(name) === normalizedName) {
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
      matchedOSMIds.add(osmMatch.id)
    }

    const status = osmMatch ? `✓ ${matchMethod} → ${osmMatch.tags?.name}` : '✗ no match'
    console.log(`  [${ridStop.id}] ${ridStop.name}: ${status}`)

    features.push({
      type: 'Feature',
      properties: {
        id: ridStop.id,
        name: ridStop.name,
        osmId: osmMatch?.id ?? null,
        osmName: osmMatch?.tags?.name ?? null,
        matchScore: Math.round(matchScore * 100) / 100,
        matchMethod,
        seenCount: ridStop.seenCount,
        priorityScore: getPriorityScore(ridStop.id, ridStop.seenCount),
        firstSeenAt: ridStop.firstSeenAt,
        lastSeenAt: ridStop.lastSeenAt,
        source: 'ridango'
      },
      geometry: {
        type: 'Point',
        coordinates: osmMatch ? [osmMatch.lon, osmMatch.lat] : null
      }
    })
  }

  // 2. Add OSM-only stops (not matched to any Ridango stop)
  console.log('\n--- Adding OSM-only stops ---')
  let osmOnlyId = 100
  
  for (const [name, osm] of uniqueOSM) {
    if (matchedOSMIds.has(osm.id)) continue
    
    // Assign new ID for OSM-only stops
    while (features.some(f => f.properties.id === osmOnlyId)) {
      osmOnlyId++
    }
    
    console.log(`  [${osmOnlyId}] ${name} (OSM: ${osm.id})`)
    
    features.push({
      type: 'Feature',
      properties: {
        id: osmOnlyId,
        name,
        osmId: osm.id,
        osmName: name,
        matchScore: 1,
        matchMethod: 'osm-only',
        seenCount: 0,
        priorityScore: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        source: 'osm'
      },
      geometry: {
        type: 'Point',
        coordinates: [osm.lon, osm.lat]
      }
    })
    
    osmOnlyId++
  }

  // Sort: Ridango stops first (by ID), then OSM-only (by name)
  features.sort((a, b) => {
    if (a.properties.source !== b.properties.source) {
      return a.properties.source === 'ridango' ? -1 : 1
    }
    if (a.properties.source === 'ridango') {
      return a.properties.id - b.properties.id
    }
    return a.properties.name.localeCompare(b.properties.name)
  })

  // Stats
  const ridangoCount = features.filter(f => f.properties.source === 'ridango').length
  const ridangoMatched = features.filter(f => f.properties.source === 'ridango' && f.geometry.coordinates !== null).length
  const osmOnlyCount = features.filter(f => f.properties.source === 'osm').length

  const geojson: StopsGeoJSON = {
    type: 'FeatureCollection',
    generatedAt: now,
    matchStats: {
      total: features.length,
      matched: features.filter(f => f.geometry.coordinates !== null).length,
      unmatched: features.filter(f => f.geometry.coordinates === null).length,
      coveragePercent: Math.round((features.filter(f => f.geometry.coordinates !== null).length / features.length) * 100),
      ridangoStops: ridangoCount,
      osmOnlyStops: osmOnlyCount
    },
    features
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2), 'utf-8')

  console.log('\n=== Summary ===')
  console.log(`Total stops: ${features.length}`)
  console.log(`  Ridango-derived: ${ridangoCount} (${ridangoMatched} geocoded)`)
  console.log(`  OSM-only: ${osmOnlyCount}`)
  console.log(`Coverage: ${geojson.matchStats.coveragePercent}%`)
  console.log(`\nSaved to ${OUTPUT_PATH}`)
}

main().catch(console.error)
