// src/ui/ErrorBanner.tsx
// Banner displayed when the realtime feed is unavailable

import { useAppStore } from '../state/appStore'

export default function ErrorBanner() {
  const feedError = useAppStore((state) => state.feedError)

  if (!feedError) return null

  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon">⚠️</span>
      <span className="error-banner__text">
        Realtime feed unavailable. Showing last known positions.
      </span>
      <details className="error-banner__details">
        <summary>Details</summary>
        <code>{feedError}</code>
      </details>
    </div>
  )
}
