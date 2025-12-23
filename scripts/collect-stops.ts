#!/usr/bin/env bun
/**
 * Stop Collector Script
 * 
 * Fetches realtime data from the Ridango API and extracts unique stops.
 * Designed to be run periodically to build a comprehensive stop database.
 * 
 * Usage:
 *   bun run scripts/collect-stops.ts
 *   bun run scripts/collect-stops.ts --continuous  # Run continuously every 30s
 * 
 * Output:
 *   public/data/stops-derived.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get directory path (works in both Node and Bun)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Constants
const API_URL = 'https://pilet.ee/viipe/ajax/gotlandpublicrealtime?org_id=968'
const OUTPUT_PATH = join(__dirname, '../public/data/stops-derived.json')
const POLL_INTERVAL = 30_000 // 30 seconds for continuous mode

// Interchange stops get highest priority (these are the main bus terminal stops 1-11)
const INTERCHANGE_STOP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/**
 * Derived stop data structure
 */
interface DerivedStop {
  id: number
  name: string
  originalName: string    // First observed name (may differ from current)
  firstSeenAt: string     // ISO timestamp
  lastSeenAt: string      // ISO timestamp
  seenCount: number       // How many times this stop has been seen
  priorityScore: number   // Computed priority for geocoding order
}

interface StopsDatabase {
  version: number
  generatedAt: string
  totalCollectionRuns: number
  stops: DerivedStop[]
}

/**
 * Parse stop field from API format "ID: Name"
 */
function parseStopField(raw: string | null | undefined): { id: number; name: string } | null {
  if (!raw || typeof raw !== 'string') return null
  
  const match = raw.match(/^(\d+):\s*(.+)$/)
  if (!match) return null
  
  const id = parseInt(match[1], 10)
  const name = match[2].trim()
  
  if (isNaN(id) || !name) return null
  
  return { id, name }
}

/**
 * Calculate priority score for a stop
 * Interchange stops get MAX priority, others get their seenCount
 */
function calculatePriorityScore(stopId: number, seenCount: number): number {
  if (INTERCHANGE_STOP_IDS.includes(stopId)) {
    return Number.MAX_SAFE_INTEGER
  }
  return seenCount
}

/**
 * Load existing stops database or create empty one
 */
function loadDatabase(): StopsDatabase {
  if (existsSync(OUTPUT_PATH)) {
    try {
      const data = readFileSync(OUTPUT_PATH, 'utf-8')
      return JSON.parse(data) as StopsDatabase
    } catch (error) {
      console.warn('Failed to load existing database, starting fresh:', error)
    }
  }
  
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalCollectionRuns: 0,
    stops: []
  }
}

/**
 * Save stops database to file
 */
function saveDatabase(db: StopsDatabase): void {
  db.generatedAt = new Date().toISOString()
  writeFileSync(OUTPUT_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

/**
 * Fetch current vehicle data from API
 */
async function fetchVehicles(): Promise<Record<string, unknown>> {
  const response = await fetch(API_URL, {
    headers: { 'Accept': 'application/json' }
  })
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }
  
  return await response.json()
}

/**
 * Extract all stops from vehicle data
 */
function extractStops(vehicles: Record<string, unknown>): Map<number, string> {
  const stops = new Map<number, string>()
  
  for (const vehicle of Object.values(vehicles)) {
    if (typeof vehicle !== 'object' || vehicle === null) continue
    
    const v = vehicle as Record<string, unknown>
    
    // Extract from stop_name
    const currentStop = parseStopField(v.stop_name as string)
    if (currentStop) {
      stops.set(currentStop.id, currentStop.name)
    }
    
    // Extract from next_stop_name
    const nextStop = parseStopField(v.next_stop_name as string)
    if (nextStop) {
      stops.set(nextStop.id, nextStop.name)
    }
  }
  
  return stops
}

/**
 * Update database with newly discovered stops
 */
function updateDatabase(db: StopsDatabase, discoveredStops: Map<number, string>): { added: number; updated: number } {
  const now = new Date().toISOString()
  const existingStops = new Map(db.stops.map(s => [s.id, s]))
  
  let added = 0
  let updated = 0
  
  for (const [id, name] of discoveredStops) {
    const existing = existingStops.get(id)
    
    if (existing) {
      // Update existing stop
      existing.lastSeenAt = now
      existing.seenCount += 1
      existing.priorityScore = calculatePriorityScore(id, existing.seenCount)
      
      // Update name if different (keep original)
      if (existing.name !== name) {
        existing.name = name
      }
      updated++
    } else {
      // Add new stop
      const newStop: DerivedStop = {
        id,
        name,
        originalName: name,
        firstSeenAt: now,
        lastSeenAt: now,
        seenCount: 1,
        priorityScore: calculatePriorityScore(id, 1)
      }
      db.stops.push(newStop)
      existingStops.set(id, newStop)
      added++
    }
  }
  
  // Sort stops by priority score (descending), then by id for deterministic order
  db.stops.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore
    }
    return a.id - b.id
  })
  
  db.totalCollectionRuns++
  
  return { added, updated }
}

/**
 * Run a single collection cycle
 */
async function runCollection(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Starting collection...`)
  
  try {
    // Load existing database
    const db = loadDatabase()
    console.log(`  Loaded database with ${db.stops.length} existing stops`)
    
    // Fetch current vehicles
    const vehicles = await fetchVehicles()
    const vehicleCount = Object.keys(vehicles).length
    console.log(`  Fetched ${vehicleCount} vehicles from API`)
    
    // Extract stops
    const discoveredStops = extractStops(vehicles)
    console.log(`  Extracted ${discoveredStops.size} unique stops from current data`)
    
    // Update database
    const { added, updated } = updateDatabase(db, discoveredStops)
    console.log(`  Added ${added} new stops, updated ${updated} existing`)
    
    // Save database
    saveDatabase(db)
    console.log(`  Saved database with ${db.stops.length} total stops`)
    console.log(`  Total collection runs: ${db.totalCollectionRuns}`)
    
  } catch (error) {
    console.error('  Collection failed:', error)
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const continuous = args.includes('--continuous')
  
  console.log('=== Stop Collector ===')
  console.log(`Output: ${OUTPUT_PATH}`)
  console.log(`Mode: ${continuous ? 'Continuous' : 'Single run'}`)
  
  if (continuous) {
    console.log(`Poll interval: ${POLL_INTERVAL / 1000}s`)
    
    // Run immediately, then on interval
    await runCollection()
    
    setInterval(async () => {
      await runCollection()
    }, POLL_INTERVAL)
    
    // Keep process alive
    console.log('\nRunning continuously. Press Ctrl+C to stop.')
  } else {
    await runCollection()
    console.log('\nDone!')
  }
}

main().catch(console.error)
