// workers/nuuk-realtime/worker.ts
// Cloudflare Worker for proxying the Nuuk bus realtime feed

/**
 * Nuuk Bus Realtime Proxy Worker
 * 
 * This worker proxies requests to the pilet.ee realtime feed and adds:
 * - CORS headers for cross-origin access
 * - Cache-Control headers for edge caching
 * - Optional ETag forwarding
 * 
 * Deploy with:
 *   cd workers/nuuk-realtime
 *   wrangler deploy
 */

interface Env {
  // Optional: Override org_id via environment variable
  ORG_ID?: string
}

const UPSTREAM_BASE = 'https://pilet.ee/viipe/ajax/gotlandpublicrealtime'
const DEFAULT_ORG_ID = '968'
const CACHE_MAX_AGE = 2 // seconds

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Only handle /api/nuuk-realtime
    if (url.pathname !== '/api/nuuk-realtime') {
      return new Response('Not Found', { status: 404 })
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    try {
      const orgId = env.ORG_ID || DEFAULT_ORG_ID
      const upstreamUrl = `${UPSTREAM_BASE}?org_id=${orgId}`

      // Fetch from upstream
      const upstreamResponse = await fetch(upstreamUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NuukBusLiveMap/1.0',
        },
      })

      if (!upstreamResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Upstream request failed', status: upstreamResponse.status }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        )
      }

      const data = await upstreamResponse.text()

      // Build response with CORS and cache headers
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      })

      // Forward ETag if present
      const etag = upstreamResponse.headers.get('ETag')
      if (etag) {
        headers.set('ETag', etag)
      }

      // Forward Last-Modified if present
      const lastModified = upstreamResponse.headers.get('Last-Modified')
      if (lastModified) {
        headers.set('Last-Modified', lastModified)
      }

      return new Response(data, {
        status: 200,
        headers,
      })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }
  },
}
