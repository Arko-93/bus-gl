// src/map/StopsLayer.tsx
// Optional layer for bus stops (behind feature flag)

import { useEffect, useState } from 'react'
import { GeoJSON } from 'react-leaflet'
import L from 'leaflet'

interface StopFeature {
  type: 'Feature'
  properties: {
    name: string
    id?: string
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
}

interface StopsGeoJSON {
  type: 'FeatureCollection'
  features: StopFeature[]
}

export default function StopsLayer() {
  const [stopsData, setStopsData] = useState<StopsGeoJSON | null>(null)

  useEffect(() => {
    fetch('/data/stops.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Stops data not found')
        return res.json()
      })
      .then(setStopsData)
      .catch((err) => {
        console.warn('Failed to load stops layer:', err)
      })
  }, [])

  if (!stopsData) return null

  return (
    <GeoJSON
      data={stopsData}
      pointToLayer={(_feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: '#6366f1',
          color: '#4f46e5',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        })
      }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties as StopFeature['properties']
        if (props.name) {
          layer.bindTooltip(props.name, {
            permanent: false,
            direction: 'top',
          })
        }
      }}
    />
  )
}
