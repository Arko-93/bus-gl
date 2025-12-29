import { test, expect, type Page } from '@playwright/test'

const STORAGE_KEY = 'nuuk-bus-preferences'
const STORE_MODULE_PATH = '/src/state/appStore.ts'

const waitForMarkers = async (page: Page) => {
  await expect(page.locator('.bus-marker')).toHaveCount(2)
}

const buildMockVehicles = () => {
  const updatedAt = new Date().toISOString()
  return {
    'vehicle-1': {
      device_id: 'dev-1',
      current_gps_latitude: 64.1887,
      current_gps_longitude: -51.7116,
      route_short_name: '1',
      route_long_name: 'Route 1',
      updated_at: updatedAt,
      stop_name: '1: Eqalugalinnguit',
      next_stop_name: '2: Nunngarut',
      current_bus_speed: 22,
      at_stop: 'false',
      trip_headsign: 'Downtown',
      location_id: 'NK-01',
      trip_id: 'trip-1',
    },
    'vehicle-2': {
      device_id: 'dev-2',
      current_gps_latitude: 64.1848,
      current_gps_longitude: -51.7042,
      route_short_name: '2',
      route_long_name: 'Route 2',
      updated_at: updatedAt,
      stop_name: '2: Nunngarut',
      next_stop_name: '3: Illorput',
      current_bus_speed: 18,
      at_stop: 'true',
      trip_headsign: 'Uptown',
      location_id: 'NK-02',
      trip_id: 'trip-2',
    },
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state: {
          locale: 'en',
          theme: 'light',
          enabledRoutes: ['1', '2', '3', 'X2', 'E2', 'X3'],
        },
      })
    )
  }, STORAGE_KEY)

  await page.route('**/api/nuuk-realtime', async (route) => {
    const payload = buildMockVehicles()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
})

test('loads core UI', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'BUSSIT' })).toBeVisible()
  await expect(page.locator('.map-container')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Filter buses by route' })).toBeVisible()
})

test('route filter updates bus count', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('2 buses operating')).toBeVisible()

  const route1Button = page.getByRole('button', { name: 'Route 1' })
  await route1Button.click()

  await expect(route1Button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1 bus')).toBeVisible()
})

test('routes layer renders when enabled', async ({ page }) => {
  await page.goto('/')

  const routePaths = page.locator('.leaflet-overlay-pane path[stroke-dasharray="10, 5"]')
  await expect(routePaths.first()).toBeVisible()
})

test('selected route path renders when stop filter is active', async ({ page }) => {
  await page.goto('/')

  const stopFilterToggle = page.getByRole('button', { name: 'Bus stops' })
  await stopFilterToggle.click()
  const routeButton = page.locator('.stop-filter__route-btn', { hasText: 'Route 1' })
  await routeButton.click()

  await expect(page.locator('.route-path--base').first()).toBeVisible()
  await expect(page.locator('.route-path--pulse, .route-path--loading').first()).toBeVisible()
})

test('OSRM fallback keeps route path visible on failure', async ({ page }) => {
  let osrmRequests = 0
  await page.route('**/route/v1/**', async (route) => {
    osrmRequests += 1
    await route.fulfill({ status: 500, body: 'OSRM error' })
  })

  await page.goto('/')

  const stopFilterToggle = page.getByRole('button', { name: 'Bus stops' })
  await stopFilterToggle.click()
  const routeButton = page.locator('.stop-filter__route-btn', { hasText: 'Route 1' })
  await routeButton.click()

  await expect.poll(() => osrmRequests).toBeGreaterThan(0)
  await expect(page.locator('.route-path--base').first()).toBeVisible()
  await expect(page.locator('.route-path--pulse').first()).toBeVisible()
})

test('OSRM success replaces loading path with pulse', async ({ page }) => {
  let osrmRequests = 0
  await page.route('**/route/v1/**', async (route) => {
    osrmRequests += 1
    await new Promise((resolve) => setTimeout(resolve, 120))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        routes: [
          {
            geometry: {
              coordinates: [
                [-51.7116, 64.1887],
                [-51.7042, 64.1848],
              ],
            },
          },
        ],
      }),
    })
  })

  await page.goto('/')

  const stopFilterToggle = page.getByRole('button', { name: 'Bus stops' })
  await stopFilterToggle.click()
  const routeButton = page.locator('.stop-filter__route-btn', { hasText: 'Route 1' })
  await routeButton.click()

  await expect.poll(() => osrmRequests).toBeGreaterThan(0)
  await expect(page.locator('.route-path--loading').first()).toBeVisible()
  await expect(page.locator('.route-path--pulse').first()).toBeVisible()
  await expect.poll(async () => page.locator('.route-path--loading').count()).toBe(0)
})

test('bus marker opens popup on desktop', async ({ page }) => {
  await page.goto('/')
  await waitForMarkers(page)

  await page.locator('.bus-marker').first().click({ force: true })
  const popupRoute = page.locator('.leaflet-popup .bus-popup__route')
  await expect(popupRoute).toBeVisible()
  await expect(popupRoute).toHaveText(/Route (1|2)/)
})

test('stop filter selects a route', async ({ page }) => {
  await page.goto('/')

  const stopFilterToggle = page.getByRole('button', { name: 'Bus stops' })
  await stopFilterToggle.click()
  await expect(page.locator('.stop-filter__panel')).toBeVisible()

  const routeButton = page.locator('.stop-filter__route-btn', { hasText: 'Route 1' })
  await routeButton.click()

  await expect(page.locator('.stop-filter__selected-route')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Full route' })).toHaveAttribute('aria-pressed', 'true')
})

test('language and theme switchers work', async ({ page }) => {
  await page.goto('/')

  const languageButton = page.getByRole('button', { name: 'Language: English' })
  await languageButton.click()
  await expect(page.getByRole('option', { name: 'Dansk' })).toBeVisible()
  await page.getByRole('option', { name: 'Dansk' }).click()
  await expect(page.getByRole('button', { name: 'Language: Dansk' })).toBeVisible()

  const themeButton = page.locator('.theme-switcher__toggle')
  await themeButton.click()
  await page.getByRole('option', { name: /Dark|Mørk|Taartoq/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('stop search returns results', async ({ page }) => {
  await page.goto('/')

  const searchInput = page.getByPlaceholder('Search stops')
  await expect(searchInput).toBeVisible()
  await searchInput.fill('Nun')

  const result = page.getByRole('button', { name: 'Nunngarut' })
  await expect(result).toBeVisible()
  await result.click()
  await expect(searchInput).toHaveValue('Nunngarut')
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('tap marker opens bottom sheet', async ({ page }) => {
    await page.goto('/')
    await waitForMarkers(page)

    await page.locator('.bus-marker').first().click({ force: true })
    await expect(page.locator('.bottom-sheet')).toBeVisible()
    await expect(page.locator('.bottom-sheet__route-badge')).toBeVisible()
  })

  test('stop details show when stop selected', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(async (modulePath) => {
      const { useAppStore } = await import(modulePath)
      useAppStore.getState().setSelectedStopRoute('1')
      useAppStore.getState().setSelectedStopId(1, { openPanel: true })
    }, STORE_MODULE_PATH)

    await expect(page.locator('.bottom-sheet')).toBeVisible()
    await expect(page.locator('.bottom-sheet__title h2')).toHaveText('Eqalugalinnguit')
    await expect(page.getByText('Stop #1')).toBeVisible()
    await expect(page.locator('.bottom-sheet .stop-schedule__time').first()).toBeVisible()
  })

  test('stop schedule shows service ended state late at night', async ({ page }) => {
    await page.addInitScript({
      content: `
        (() => {
          const fixed = new Date(2025, 0, 2, 23, 59, 30)
          const OriginalDate = Date
          class MockDate extends OriginalDate {
            constructor(...args) {
              if (args.length === 0) {
                return new OriginalDate(fixed)
              }
              return new OriginalDate(...args)
            }
            static now() {
              return fixed.getTime()
            }
          }
          MockDate.parse = OriginalDate.parse
          MockDate.UTC = OriginalDate.UTC
          MockDate.prototype = OriginalDate.prototype
          Object.setPrototypeOf(MockDate, OriginalDate)
          globalThis.Date = MockDate
        })()
      `,
    })

    await page.goto('/')

    await page.evaluate(async (modulePath) => {
      const { useAppStore } = await import(modulePath)
      useAppStore.getState().setSelectedStopRoute('1')
      useAppStore.getState().setSelectedStopId(1, { openPanel: true })
    }, STORE_MODULE_PATH)

    await expect(page.locator('.bottom-sheet')).toBeVisible()
    await expect(page.getByText('Service ended')).toBeVisible()
  })
})
