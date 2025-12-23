// src/ui/LoadingSkeleton.tsx
// Skeleton loading state for the map

import { Bus } from 'lucide-react'
import { useVehiclesQuery } from '../data/vehiclesQuery'
import { useTranslation } from '../i18n/useTranslation'

export default function LoadingSkeleton() {
  const { isLoading } = useVehiclesQuery()
  const t = useTranslation()

  if (!isLoading) return null

  return (
    <div className="loading-skeleton">
      <div className="loading-skeleton__content">
        <div className="loading-skeleton__icon"><Bus size={48} /></div>
        <div className="loading-skeleton__text">{t.loadingBuses}</div>
        <div className="loading-skeleton__dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  )
}
