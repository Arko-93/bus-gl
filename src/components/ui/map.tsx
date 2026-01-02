import MapLibreGL, { type PopupOptions, type MarkerOptions } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X, Minus, Plus, Locate, Maximize, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

declare global {
  interface Window {
    __maplibre?: MapLibreGL.Map
  }
}

type MapContextValue = {
  map: MapLibreGL.Map | null
  isLoaded: boolean
}

const MapContext = createContext<MapContextValue | null>(null)

function useMap() {
  const context = useContext(MapContext)
  if (!context) {
    throw new Error('useMap must be used within a Map component')
  }
  return context
}

const defaultStyles = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
}

type MapStyleOption = string | MapLibreGL.StyleSpecification

type MapProps = {
  children?: ReactNode
  /** Custom map styles for light and dark themes. Overrides the default Carto styles. */
  styles?: {
    light?: MapStyleOption
    dark?: MapStyleOption
  }
} & Omit<MapLibreGL.MapOptions, 'container' | 'style'>

const DefaultLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="flex gap-1">
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:150ms]" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:300ms]" />
    </div>
  </div>
)

function Map({ children, styles, ...props }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreGL.Map | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isStyleLoaded, setIsStyleLoaded] = useState(false)
  const resolvedTheme = useResolvedTheme()

  const mapStyles = useMemo(
    () => ({
      dark: styles?.dark ?? defaultStyles.dark,
      light: styles?.light ?? defaultStyles.light,
    }),
    [styles]
  )

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || !containerRef.current) return

    const mapStyle = resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light

    const mapInstance = new MapLibreGL.Map({
      container: containerRef.current,
      style: mapStyle,
      attributionControl: false,
      ...props,
    })

    const styleDataHandler = () => setIsStyleLoaded(true)
    const loadHandler = () => setIsLoaded(true)

    mapInstance.on('load', loadHandler)
    mapInstance.on('styledata', styleDataHandler)
    mapRef.current = mapInstance

    if (import.meta.env.DEV) {
      window.__maplibre = mapInstance
    }

    return () => {
      mapInstance.off('load', loadHandler)
      mapInstance.off('styledata', styleDataHandler)
      if (import.meta.env.DEV) {
        window.__maplibre = undefined
      }
      mapInstance.remove()
      mapRef.current = null
    }
  }, [isMounted])

  useEffect(() => {
    if (mapRef.current) {
      setIsStyleLoaded(false)
      mapRef.current.setStyle(
        resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light,
        { diff: true }
      )
    }
  }, [resolvedTheme, mapStyles])

  const isLoading = !isMounted || !isLoaded || !isStyleLoaded

  return (
    <MapContext.Provider
      value={{
        map: mapRef.current,
        isLoaded: isMounted && isLoaded && isStyleLoaded,
      }}
    >
      <div ref={containerRef} className="relative h-full w-full">
        {isLoading && <DefaultLoader />}
        {isMounted && children}
      </div>
    </MapContext.Provider>
  )
}

type MarkerContextValue = {
  markerRef: React.RefObject<MapLibreGL.Marker | null>
  markerElementRef: React.RefObject<HTMLDivElement | null>
  map: MapLibreGL.Map | null
  isReady: boolean
}

const MarkerContext = createContext<MarkerContextValue | null>(null)

function useMarkerContext() {
  const context = useContext(MarkerContext)
  if (!context) {
    throw new Error('Marker components must be used within MapMarker')
  }
  return context
}

type MapMarkerProps = {
  longitude: number
  latitude: number
  children: ReactNode
  onClick?: (e: MouseEvent) => void
  onMouseEnter?: (e: MouseEvent) => void
  onMouseLeave?: (e: MouseEvent) => void
  onDragStart?: (lngLat: { lng: number; lat: number }) => void
  onDrag?: (lngLat: { lng: number; lat: number }) => void
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void
} & Omit<MarkerOptions, 'element'>

function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  draggable = false,
  ...markerOptions
}: MapMarkerProps) {
  const { map, isLoaded } = useMap()
  const markerRef = useRef<MapLibreGL.Marker | null>(null)
  const markerElementRef = useRef<HTMLDivElement | null>(null)
  const [isReady, setIsReady] = useState(false)
  const markerOptionsRef = useRef(markerOptions)

  // Store callbacks in refs to avoid recreating marker when they change
  const onClickRef = useRef(onClick)
  const onMouseEnterRef = useRef(onMouseEnter)
  const onMouseLeaveRef = useRef(onMouseLeave)
  const onDragStartRef = useRef(onDragStart)
  const onDragRef = useRef(onDrag)
  const onDragEndRef = useRef(onDragEnd)

  // Keep refs in sync with props
  useEffect(() => { onClickRef.current = onClick }, [onClick])
  useEffect(() => { onMouseEnterRef.current = onMouseEnter }, [onMouseEnter])
  useEffect(() => { onMouseLeaveRef.current = onMouseLeave }, [onMouseLeave])
  useEffect(() => { onDragStartRef.current = onDragStart }, [onDragStart])
  useEffect(() => { onDragRef.current = onDrag }, [onDrag])
  useEffect(() => { onDragEndRef.current = onDragEnd }, [onDragEnd])

  useEffect(() => {
    if (!isLoaded || !map) return

    const container = document.createElement('div')
    markerElementRef.current = container

    const marker = new MapLibreGL.Marker({
      ...markerOptions,
      element: container,
      draggable,
    })
      .setLngLat([longitude, latitude])
      .addTo(map)

    markerRef.current = marker

    const handleClick = (e: MouseEvent) => onClickRef.current?.(e)
    const handleMouseEnter = (e: MouseEvent) => onMouseEnterRef.current?.(e)
    const handleMouseLeave = (e: MouseEvent) => onMouseLeaveRef.current?.(e)

    container.addEventListener('click', handleClick)
    container.addEventListener('mouseenter', handleMouseEnter)
    container.addEventListener('mouseleave', handleMouseLeave)

    const handleDragStart = () => {
      const lngLat = marker.getLngLat()
      onDragStartRef.current?.({ lng: lngLat.lng, lat: lngLat.lat })
    }
    const handleDrag = () => {
      const lngLat = marker.getLngLat()
      onDragRef.current?.({ lng: lngLat.lng, lat: lngLat.lat })
    }
    const handleDragEnd = () => {
      const lngLat = marker.getLngLat()
      onDragEndRef.current?.({ lng: lngLat.lng, lat: lngLat.lat })
    }

    marker.on('dragstart', handleDragStart)
    marker.on('drag', handleDrag)
    marker.on('dragend', handleDragEnd)

    setIsReady(true)

    return () => {
      container.removeEventListener('click', handleClick)
      container.removeEventListener('mouseenter', handleMouseEnter)
      container.removeEventListener('mouseleave', handleMouseLeave)

      marker.off('dragstart', handleDragStart)
      marker.off('drag', handleDrag)
      marker.off('dragend', handleDragEnd)

      marker.remove()
      markerRef.current = null
      markerElementRef.current = null
      setIsReady(false)
    }
  }, [map, isLoaded, draggable])

  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude])
  }, [longitude, latitude])

  useEffect(() => {
    markerRef.current?.setDraggable(draggable)
  }, [draggable])

  useEffect(() => {
    if (!markerRef.current) return
    const prev = markerOptionsRef.current

    if (prev.offset !== markerOptions.offset) {
      markerRef.current.setOffset(markerOptions.offset ?? [0, 0])
    }
    if (prev.rotation !== markerOptions.rotation) {
      markerRef.current.setRotation(markerOptions.rotation ?? 0)
    }
    if (prev.rotationAlignment !== markerOptions.rotationAlignment) {
      markerRef.current.setRotationAlignment(
        markerOptions.rotationAlignment ?? 'auto'
      )
    }
    if (prev.pitchAlignment !== markerOptions.pitchAlignment) {
      markerRef.current.setPitchAlignment(
        markerOptions.pitchAlignment ?? 'auto'
      )
    }

    markerOptionsRef.current = markerOptions
  }, [markerOptions])

  return (
    <MarkerContext.Provider
      value={{ markerRef, markerElementRef, map, isReady }}
    >
      {children}
    </MarkerContext.Provider>
  )
}

type MarkerContentProps = {
  children?: ReactNode
  className?: string
}

function MarkerContent({ children, className }: MarkerContentProps) {
  const { markerElementRef, isReady } = useMarkerContext()

  if (!isReady || !markerElementRef.current) return null

  return createPortal(
    <div className={cn('relative cursor-pointer', className)}>
      {children || <DefaultMarkerIcon />}
    </div>,
    markerElementRef.current
  )
}

function DefaultMarkerIcon() {
  return (
    <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
  )
}

type MarkerPopupProps = {
  children: ReactNode
  className?: string
  closeButton?: boolean
} & Omit<PopupOptions, 'className'>

function MarkerPopup({
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MarkerPopupProps) {
  const { markerRef, isReady } = useMarkerContext()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const popupRef = useRef<MapLibreGL.Popup | null>(null)
  const [mounted, setMounted] = useState(false)
  const popupOptionsRef = useRef(popupOptions)

  useEffect(() => {
    if (!isReady || !markerRef.current) return

    const container = document.createElement('div')
    containerRef.current = container

    const popup = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth('none')
      .setDOMContent(container)

    popupRef.current = popup
    markerRef.current.setPopup(popup)
    setMounted(true)

    return () => {
      popup.remove()
      popupRef.current = null
      containerRef.current = null
      setMounted(false)
    }
  }, [isReady])

  useEffect(() => {
    if (!popupRef.current) return
    const prev = popupOptionsRef.current

    if (prev.offset !== popupOptions.offset) {
      popupRef.current.setOffset(popupOptions.offset ?? 16)
    }
    if (prev.maxWidth !== popupOptions.maxWidth && popupOptions.maxWidth) {
      popupRef.current.setMaxWidth(popupOptions.maxWidth ?? 'none')
    }

    popupOptionsRef.current = popupOptions
  }, [popupOptions])

  const handleClose = () => popupRef.current?.remove()

  if (!mounted || !containerRef.current) return null

  return createPortal(
    <div className={cn('map-popup', className)}>
      {closeButton && (
        <button
          type="button"
          onClick={handleClose}
          className="map-popup__close"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      <div className="map-popup__content">{children}</div>
    </div>,
    containerRef.current
  )
}

type MarkerTooltipProps = {
  children: ReactNode
  className?: string
} & Omit<PopupOptions, 'className' | 'closeButton' | 'closeOnClick'>

function MarkerTooltip({
  children,
  className,
  ...popupOptions
}: MarkerTooltipProps) {
  const { markerRef, markerElementRef, map, isReady } = useMarkerContext()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const popupRef = useRef<MapLibreGL.Popup | null>(null)
  const [mounted, setMounted] = useState(false)
  const popupOptionsRef = useRef(popupOptions)

  useEffect(() => {
    if (!isReady || !markerRef.current || !markerElementRef.current || !map)
      return

    const container = document.createElement('div')
    containerRef.current = container

    const popup = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeOnClick: true,
      closeButton: false,
    })
      .setMaxWidth('none')
      .setDOMContent(container)

    popupRef.current = popup

    const markerElement = markerElementRef.current
    const marker = markerRef.current

    const handleMouseEnter = () => {
      popup.setLngLat(marker.getLngLat()).addTo(map)
    }
    const handleMouseLeave = () => popup.remove()

    markerElement.addEventListener('mouseenter', handleMouseEnter)
    markerElement.addEventListener('mouseleave', handleMouseLeave)
    setMounted(true)

    return () => {
      markerElement.removeEventListener('mouseenter', handleMouseEnter)
      markerElement.removeEventListener('mouseleave', handleMouseLeave)
      popup.remove()
      popupRef.current = null
      containerRef.current = null
      setMounted(false)
    }
  }, [isReady, map])

  useEffect(() => {
    if (!popupRef.current) return
    const prev = popupOptionsRef.current

    if (prev.offset !== popupOptions.offset) {
      popupRef.current.setOffset(popupOptions.offset ?? 16)
    }
    if (prev.maxWidth !== popupOptions.maxWidth && popupOptions.maxWidth) {
      popupRef.current.setMaxWidth(popupOptions.maxWidth ?? 'none')
    }

    popupOptionsRef.current = popupOptions
  }, [popupOptions])

  if (!mounted || !containerRef.current) return null

  return createPortal(
    <div className={cn('map-popup', className)}>
      <div className="map-popup__content">{children}</div>
    </div>,
    containerRef.current
  )
}

type MarkerLabelProps = {
  children: ReactNode
  className?: string
  position?: 'top' | 'bottom'
}

function MarkerLabel({
  children,
  className,
  position = 'top',
}: MarkerLabelProps) {
  const positionClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
  }

  return (
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 whitespace-nowrap',
        'text-[10px] font-medium text-foreground',
        positionClasses[position],
        className
      )}
    >
      {children}
    </div>
  )
}

type MapControlsProps = {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  showZoom?: boolean
  showCompass?: boolean
  showLocate?: boolean
  showFullscreen?: boolean
  className?: string
  onLocate?: (coords: { longitude: number; latitude: number }) => void
}

const positionClasses = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="map-controls__group flex flex-col overflow-hidden">
      {children}
    </div>
  )
}

function ControlButton({
  onClick,
  label,
  children,
  disabled = false,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      type="button"
      className={cn(
        'map-controls__button flex items-center justify-center transition-colors',
        disabled && 'map-controls__button--disabled'
      )}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function MapControls({
  position = 'bottom-right',
  showZoom = true,
  showCompass = false,
  showLocate = false,
  showFullscreen = false,
  className,
  onLocate,
}: MapControlsProps) {
  const { map, isLoaded } = useMap()
  const [waitingForLocation, setWaitingForLocation] = useState(false)

  const handleZoomIn = useCallback(() => {
    map?.zoomTo(map.getZoom() + 1, { duration: 300 })
  }, [map])

  const handleZoomOut = useCallback(() => {
    map?.zoomTo(map.getZoom() - 1, { duration: 300 })
  }, [map])

  const handleResetBearing = useCallback(() => {
    map?.resetNorthPitch({ duration: 300 })
  }, [map])

  const handleLocate = useCallback(() => {
    setWaitingForLocation(true)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
          }
          map?.flyTo({
            center: [coords.longitude, coords.latitude],
            zoom: 14,
            duration: 1500,
          })
          onLocate?.(coords)
          setWaitingForLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          setWaitingForLocation(false)
        }
      )
    }
  }, [map, onLocate])

  const handleFullscreen = useCallback(() => {
    const container = map?.getContainer()
    if (!container) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }, [map])

  if (!isLoaded) return null

  return (
    <div
      className={cn(
        'map-controls absolute z-10 flex flex-col gap-1.5',
        positionClasses[position],
        className
      )}
    >
      {showZoom && (
        <ControlGroup>
          <ControlButton onClick={handleZoomIn} label="Zoom in">
            <Plus className="size-4" />
          </ControlButton>
          <ControlButton onClick={handleZoomOut} label="Zoom out">
            <Minus className="size-4" />
          </ControlButton>
        </ControlGroup>
      )}
      {showCompass && (
        <ControlGroup>
          <CompassButton onClick={handleResetBearing} />
        </ControlGroup>
      )}
      {showLocate && (
        <ControlGroup>
          <ControlButton
            onClick={handleLocate}
            label="Find my location"
            disabled={waitingForLocation}
          >
            {waitingForLocation ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Locate className="size-4" />
            )}
          </ControlButton>
        </ControlGroup>
      )}
      {showFullscreen && (
        <ControlGroup>
          <ControlButton onClick={handleFullscreen} label="Toggle fullscreen">
            <Maximize className="size-4" />
          </ControlButton>
        </ControlGroup>
      )}
    </div>
  )
}

function CompassButton({ onClick }: { onClick: () => void }) {
  const { isLoaded, map } = useMap()
  const compassRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!isLoaded || !map || !compassRef.current) return

    const compass = compassRef.current

    const updateRotation = () => {
      const bearing = map.getBearing()
      const pitch = map.getPitch()
      compass.style.transform = `rotateX(${pitch}deg) rotateZ(${-bearing}deg)`
    }

    map.on('rotate', updateRotation)
    map.on('pitch', updateRotation)
    updateRotation()

    return () => {
      map.off('rotate', updateRotation)
      map.off('pitch', updateRotation)
    }
  }, [isLoaded, map])

  return (
    <ControlButton onClick={onClick} label="Reset bearing to north">
      <svg
        ref={compassRef}
        viewBox="0 0 24 24"
        className="size-5 transition-transform duration-200"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <path d="M12 2L16 12H12V2Z" className="fill-red-500" />
        <path d="M12 2L8 12H12V2Z" className="fill-red-300" />
        <path d="M12 22L16 12H12V22Z" className="fill-muted-foreground/60" />
        <path d="M12 22L8 12H12V22Z" className="fill-muted-foreground/30" />
      </svg>
    </ControlButton>
  )
}

type MapPopupProps = {
  longitude: number
  latitude: number
  onClose?: () => void
  children: ReactNode
  className?: string
  closeButton?: boolean
} & Omit<PopupOptions, 'className'>

function MapPopup({
  longitude,
  latitude,
  onClose,
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MapPopupProps) {
  const { map } = useMap()
  const popupRef = useRef<MapLibreGL.Popup | null>(null)
  const popupOptionsRef = useRef(popupOptions)

  const container = useMemo(() => document.createElement('div'), [])

  useEffect(() => {
    if (!map) return

    const popup = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth('none')
      .setDOMContent(container)
      .setLngLat([longitude, latitude])
      .addTo(map)

    const onCloseProp = () => onClose?.()

    popup.on('close', onCloseProp)

    popupRef.current = popup

    return () => {
      popup.off('close', onCloseProp)
      if (popup.isOpen()) {
        popup.remove()
      }
      popupRef.current = null
    }
  }, [map])

  useEffect(() => {
    popupRef.current?.setLngLat([longitude, latitude])
  }, [longitude, latitude])

  useEffect(() => {
    if (!popupRef.current) return
    const prev = popupOptionsRef.current

    if (prev.offset !== popupOptions.offset) {
      popupRef.current.setOffset(popupOptions.offset ?? 16)
    }
    if (prev.maxWidth !== popupOptions.maxWidth && popupOptions.maxWidth) {
      popupRef.current.setMaxWidth(popupOptions.maxWidth ?? 'none')
    }

    popupOptionsRef.current = popupOptions
  }, [popupOptions])

  const handleClose = () => {
    popupRef.current?.remove()
    onClose?.()
  }

  return createPortal(
    <div className={cn('map-popup', className)}>
      {closeButton && (
        <button
          type="button"
          onClick={handleClose}
          className="map-popup__close"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      <div className="map-popup__content">{children}</div>
    </div>,
    container
  )
}

type MapRouteProps = {
  coordinates: [number, number][]
  color?: string
  width?: number
  opacity?: number
  dashArray?: [number, number]
  /** Tooltip text shown on hover (sticky, follows cursor) */
  tooltip?: string
  /** @deprecated Animation disabled due to MapLibre LineAtlas limitations */
  animated?: boolean
  /** @deprecated Animation disabled due to MapLibre LineAtlas limitations */
  animationDuration?: number
}

function MapRoute({
  coordinates,
  color = '#4285F4',
  width = 3,
  opacity = 0.8,
  dashArray,
  tooltip,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  animated: _animated = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  animationDuration: _animationDuration = 1400,
}: MapRouteProps) {
  const { map, isLoaded } = useMap()
  const id = useId()
  const sourceId = `route-source-${id}`
  const layerId = `route-layer-${id}`
  const [styleVersion, setStyleVersion] = useState(0)
  const popupRef = useRef<MapLibreGL.Popup | null>(null)

  // Track style changes to re-add layers
  useEffect(() => {
    if (!map) return
    const handleStyleData = () => {
      setStyleVersion((v) => v + 1)
    }
    map.on('styledata', handleStyleData)
    return () => {
      map.off('styledata', handleStyleData)
    }
  }, [map])

  // Add source and layer (re-runs on style change)
  useEffect(() => {
    if (!isLoaded || !map) return

    // Check if source already exists (from previous style)
    if (map.getSource(sourceId)) return

    // Find the first symbol layer to insert route below labels
    const layers = map.getStyle()?.layers || []
    let beforeId: string | undefined
    for (const layer of layers) {
      if (layer.type === 'symbol') {
        beforeId = layer.id
        break
      }
    }

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] },
      },
    })

    map.addLayer(
      {
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
          ...(dashArray && { 'line-dasharray': dashArray }),
        },
      },
      beforeId
    )

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {
        // ignore
      }
    }
  }, [isLoaded, map, sourceId, layerId, styleVersion])

  useEffect(() => {
    if (!isLoaded || !map || coordinates.length < 2) return

    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })
    }
  }, [isLoaded, map, coordinates, sourceId])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return

    map.setPaintProperty(layerId, 'line-color', color)
    map.setPaintProperty(layerId, 'line-width', width)
    map.setPaintProperty(layerId, 'line-opacity', opacity)
    // Set dasharray - use [1, 0] for solid line (effectively no dash)
    map.setPaintProperty(layerId, 'line-dasharray', dashArray || [1, 0])
  }, [isLoaded, map, layerId, color, width, opacity, dashArray])

  // Tooltip on hover (sticky, follows cursor like Leaflet's sticky tooltip)
  useEffect(() => {
    if (!isLoaded || !map || !tooltip) return

    const popup = new MapLibreGL.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    })
    popupRef.current = popup

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    const handleMouseMove = (e: MapLibreGL.MapMouseEvent) => {
      popup.setLngLat(e.lngLat).setHTML(`<span class="route-tooltip">${tooltip}</span>`).addTo(map)
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
    }

    map.on('mouseenter', layerId, handleMouseEnter)
    map.on('mousemove', layerId, handleMouseMove)
    map.on('mouseleave', layerId, handleMouseLeave)

    return () => {
      map.off('mouseenter', layerId, handleMouseEnter)
      map.off('mousemove', layerId, handleMouseMove)
      map.off('mouseleave', layerId, handleMouseLeave)
      popup.remove()
      popupRef.current = null
    }
  }, [isLoaded, map, layerId, tooltip])

  // Note: Animated dash flow is disabled because MapLibre's LineAtlas
  // cannot handle frequent dash pattern changes. The dashArray prop
  // still works for static dashed lines.

  return null
}

/**
 * Animated route using SVG overlay - enables CSS animations like Leaflet
 * Renders an SVG path on top of the map that follows coordinates
 */
type AnimatedRouteSvgProps = {
  /** Coordinates in [lng, lat] format */
  coordinates: [number, number][]
  color?: string
  width?: number
  opacity?: number
  /** CSS class to apply for animations (e.g., 'bus-path bus-path--current') */
  className?: string
}

function AnimatedRouteSvg({
  coordinates,
  color = '#4285F4',
  width = 5,
  opacity = 0.9,
  className = '',
}: AnimatedRouteSvgProps) {
  const { map, isLoaded } = useMap()
  const [pathD, setPathD] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  // Convert geo coordinates to screen pixels and build SVG path
  const updatePath = useCallback(() => {
    if (!map || !isLoaded || coordinates.length < 2) {
      setPathD('')
      return
    }

    const points = coordinates.map((coord) => {
      const point = map.project(coord as [number, number])
      return point
    })

    // Build SVG path string
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    setPathD(d)
  }, [map, isLoaded, coordinates])

  // Update path on mount and when coordinates change
  useEffect(() => {
    updatePath()
  }, [updatePath])

  // Update path on map move/zoom
  useEffect(() => {
    if (!map || !isLoaded) return

    const handleMove = () => {
      requestAnimationFrame(updatePath)
    }

    map.on('move', handleMove)
    map.on('zoom', handleMove)
    map.on('resize', handleMove)

    return () => {
      map.off('move', handleMove)
      map.off('zoom', handleMove)
      map.off('resize', handleMove)
    }
  }, [map, isLoaded, updatePath])

  if (!pathD) return null

  return (
    <svg
      ref={svgRef}
      className="animated-route-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeOpacity={opacity}
        className={className}
        style={{ pointerEvents: 'none' }}
      />
    </svg>
  )
}

export {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MarkerLabel,
  MapPopup,
  MapControls,
  MapRoute,
  AnimatedRouteSvg,
}
