# Nuuk Bus Live Map

A real-time bus tracking map for Nuuk, Greenland. Built with React, Vite, TypeScript, and Leaflet.

## Features

- 🚌 **Live bus tracking** - Real-time positions updated every 8 seconds
- 🗺️ **Interactive map** - Pan, zoom, and click on buses for details
- 🎨 **Route filtering** - Toggle visibility of routes 1, 2, 3, and X2
- 📱 **Mobile-friendly** - Bottom sheet details on mobile, popups on desktop
- ⚠️ **Stale detection** - Visual indicator for outdated vehicle data
- 🔄 **Error handling** - Graceful degradation when feed is unavailable

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and customize:

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ORG_ID` | `968` | Realtime feed organization ID |
| `VITE_POLL_MS` | `8000` | Polling interval in milliseconds |
| `VITE_TILE_URL` | OSM | Map tile URL template |
| `VITE_TILE_ATTRIBUTION` | OSM | Map tile attribution HTML |
| `VITE_ENABLE_STATIC_LAYERS` | `false` | Enable stops/routes layers |
| `VITE_API_BASE_URL` | (empty) | Production API base URL |

## How to Change org_id

The realtime feed uses an `org_id` parameter to identify the transit system. The default is `968` (Nuuk).

**Note:** The API endpoint path contains `gotlandpublicrealtime` which is a legacy/reused endpoint name. The actual data source is determined by the `org_id` parameter, not the path name.

### Development

1. Edit `.env`:
   ```
   VITE_ORG_ID=YOUR_ORG_ID
   ```

2. Restart the dev server

### Production (Cloudflare Worker)

1. Edit `workers/nuuk-realtime/wrangler.toml`:
   ```toml
   [vars]
   ORG_ID = "YOUR_ORG_ID"
   ```

2. Redeploy the worker:
   ```bash
   cd workers/nuuk-realtime
   wrangler deploy
   ```

## Polling and Caching

### Frontend Polling

- Default interval: **8 seconds** (configurable via `VITE_POLL_MS`)
- Uses TanStack Query for automatic retries with exponential backoff
- Continues polling in background tabs
- Keeps last known data on error (graceful degradation)

### Stale Detection

Vehicles are marked as "stale" if their `updated_at` timestamp is older than **120 seconds**. Stale vehicles:
- Display with reduced opacity
- Show a warning badge on the marker
- Include a warning message in the details popup/sheet

### Production Proxy Caching

The Cloudflare Worker adds:
- `Cache-Control: public, max-age=2` (2 second edge cache)
- ETag and Last-Modified forwarding for conditional requests

## Mobile vs Desktop UI

The app detects viewport width using `matchMedia('(max-width: 768px)')`:

### Desktop (> 768px)
- Click bus marker → Leaflet popup with details
- Stop search visible in top bar

### Mobile (≤ 768px)
- Click bus marker → Bottom sheet slides up with details
- Stop search hidden (space constraints)
- Larger touch targets for zoom controls

The "selected vehicle" state is shared via Zustand, so both UI patterns stay in sync.

## Project Structure

```
src/
├── data/
│   ├── ridangoRealtime.ts  # Types, Zod schema, normalization
│   └── vehiclesQuery.ts    # TanStack Query hook
├── map/
│   ├── MapView.tsx         # Main map component
│   ├── BusMarker.tsx       # Individual bus marker
│   ├── StopsLayer.tsx      # GeoJSON stops layer
│   └── RoutesLayer.tsx     # GeoJSON routes layer
├── state/
│   └── appStore.ts         # Zustand state management
├── ui/
│   ├── TopBar.tsx          # Status bar
│   ├── RouteFilter.tsx     # Route toggle buttons
│   ├── BottomSheet.tsx     # Mobile details sheet
│   ├── ErrorBanner.tsx     # Feed error notification
│   └── StopSearch.tsx      # Fuse.js stop search
├── App.tsx                 # App root with providers
├── App.css                 # Component styles
├── index.css               # Global styles
└── main.tsx                # Entry point

public/data/
├── stops.geojson           # Placeholder stop data
└── routes.geojson          # Placeholder route data

workers/nuuk-realtime/
├── worker.ts               # Cloudflare Worker source
└── wrangler.toml           # Worker configuration
```

## Production Deployment

### Frontend (Static Hosting)

1. Build the app:
   ```bash
   bun run build
   ```

2. Deploy `dist/` to any static host:
   - Cloudflare Pages
   - Vercel
   - Netlify
   - GitHub Pages

### API Proxy (Cloudflare Worker)

1. Install Wrangler CLI:
   ```bash
   bun add -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy the worker:
   ```bash
   cd workers/nuuk-realtime
   wrangler deploy
   ```

4. Note the worker URL (e.g., `https://nuuk-bus-realtime.your-subdomain.workers.dev`)

5. Update frontend `.env`:
   ```
   VITE_API_BASE_URL=https://nuuk-bus-realtime.your-subdomain.workers.dev
   ```

6. Rebuild and redeploy frontend

## V2 Roadmap

### PWA Support

The app is structured for easy PWA addition:

1. Install the plugin:
   ```bash
   bun add -d vite-plugin-pwa
   ```

2. Add to `vite.config.ts`:
   ```typescript
   import { VitePWA } from 'vite-plugin-pwa'
   
   export default defineConfig({
     plugins: [
       react(),
       VitePWA({
         registerType: 'autoUpdate',
         workbox: {
           globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
           runtimeCaching: [
             {
               urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
               handler: 'CacheFirst',
               options: { cacheName: 'tiles', expiration: { maxEntries: 500 } }
             }
           ]
         }
       })
     ]
   })
   ```

### Planned Features

- [ ] Real stop data from GTFS feed
- [ ] Real route polylines from GTFS shapes
- [ ] Arrival predictions at stops
- [ ] Offline tile caching
- [ ] Push notifications for service alerts
- [ ] Multi-language support (Danish, Greenlandic, English)

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build:** [Vite](https://vitejs.dev/)
- **Map:** [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/)
- **State:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Data Fetching:** [TanStack Query](https://tanstack.com/query)
- **Search:** [Fuse.js](https://fusejs.io/)
- **Validation:** [Zod](https://zod.dev/)
- **Edge Proxy:** [Cloudflare Workers](https://workers.cloudflare.com/)

## License

MIT
