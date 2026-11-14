import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LayerSpecification, Map as MLMap, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 loads its worker from a separate file next to its module; bundlers don't copy it
// automatically, so hand Vite the file explicitly (works in dev and in the production build).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import type { Fix } from '../lib/location'
import type { Route } from '../lib/routing/types'
import { markTomTomBlocked, recordTomTomRequest } from '../lib/usage'
import {
  type MapProvider,
  TOMTOM_FLOW_SOURCE,
  openFreeMapStyleUrl,
  setSessionFallback,
  tomtomStyleUrl,
} from './provider'

void maplibregl.setWorkerUrl(workerUrl)

export type CameraMode = 'free' | 'follow' | 'ride'

export interface MapMarker {
  id: string
  kind: 'dest' | 'stop' | 'pin' | 'poi'
  lat: number
  lon: number
  label: string
}

interface Props {
  visible: boolean
  night: boolean
  traffic: boolean
  provider: MapProvider
  fix: Fix | null
  camera: CameraMode
  /** bearing of the route at the rider's position (used when GPS has no heading) */
  routeBearing: number | null
  routes: Route[]
  selectedRoute: number
  markers: MapMarker[]
  /** changes when the map should zoom out to show all routes */
  fitSeq: number
  onUserPan: () => void
  onLongPress: (lat: number, lon: number) => void
  onSelectRoute: (index: number) => void
}

// Route colours mirror the CSS theme tokens (--accent, --text-2, --bg).
const COLORS = { accent: '#D97757', alt: '#C2C0B6', casing: '#262624' }
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] }
const INDIA_CENTER: [number, number] = [78.9629, 22.5937]
const ROUTE_SRC = 'md-routes'

const isFlowLayer = (l: LayerSpecification) => 'source' in l && l.source === TOMTOM_FLOW_SOURCE

/** Hide traffic layers up front so their tiles are never requested while traffic is off. */
function withTraffic(style: StyleSpecification, on: boolean): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((l) =>
      isFlowLayer(l)
        ? ({ ...l, layout: { ...('layout' in l ? l.layout : {}), visibility: on ? 'visible' : 'none' } } as LayerSpecification)
        : l,
    ),
  }
}

function routesGeoJSON(routes: Route[], selected: number): Parameters<GeoJSONSource['setData']>[0] {
  return {
    type: 'FeatureCollection',
    features: routes.map((r, i) => ({
      type: 'Feature',
      properties: { idx: i, selected: i === selected },
      geometry: { type: 'LineString', coordinates: r.geometry },
    })),
  }
}

/** (Re)add our route layers; needed after every style change. Drawn on top of roads and traffic. */
function ensureRouteLayers(map: MLMap): void {
  if (!map.getSource(ROUTE_SRC)) {
    map.addSource(ROUTE_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  }
  if (map.getLayer('md-sel')) return
  const line = (id: string, selected: boolean, color: string, width: number) =>
    map.addLayer(
      {
        id,
        type: 'line',
        source: ROUTE_SRC,
        filter: ['==', ['get', 'selected'], selected],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': color,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, width * 0.5, 14, width, 18, width * 1.8],
        },
      },
    )
  line('md-alt-casing', false, COLORS.casing, 10)
  line('md-alt', false, COLORS.alt, 6)
  line('md-sel-casing', true, COLORS.casing, 12)
  line('md-sel', true, COLORS.accent, 8)
}

function markerElement(m: MapMarker): HTMLElement {
  const el = document.createElement('div')
  el.className = `md-pin md-pin-${m.kind}`
  const label = document.createElement('span')
  label.textContent = m.label
  el.appendChild(label)
  el.setAttribute('aria-label', m.label)
  return el
}

export default function MapView(props: Props) {
  const { visible, night, traffic, provider, fix, camera, routeBearing, routes, selectedRoute, markers, fitSeq } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const meRef = useRef<maplibregl.Marker | null>(null)
  const arrowRef = useRef<HTMLDivElement | null>(null)
  const pinsRef = useRef(new Map<string, { marker: maplibregl.Marker; key: string }>())
  const styleLoadedRef = useRef(false)
  const hasCenteredRef = useRef(false)
  const latest = useRef(props)

  useEffect(() => {
    latest.current = props
  })

  // Create the map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: EMPTY_STYLE,
      center: INDIA_CENTER,
      zoom: 4,
      attributionControl: { compact: true },
      transformRequest: (url: string) => {
        if (url.startsWith('https://api.tomtom.com/')) recordTomTomRequest(url)
        return { url }
      },
    })
    const syncRoutes = () => {
      if (!styleLoadedRef.current) return
      ensureRouteLayers(map)
      const p = latest.current
      ;(map.getSource(ROUTE_SRC) as GeoJSONSource).setData(routesGeoJSON(p.routes, p.selectedRoute))
    }
    map.on('style.load', () => {
      styleLoadedRef.current = true
      syncRoutes()
    })
    map.on('error', (e: maplibregl.ErrorEvent) => {
      if (latest.current.provider !== 'tomtom') return
      const status = (e.error as { status?: number } | undefined)?.status
      if (status === 401 || status === 403) markTomTomBlocked(`HTTP ${status}`)
      else if (!styleLoadedRef.current) setSessionFallback('TomTom map style failed to load')
    })
    map.on('dragstart', () => latest.current.onUserPan())

    // Tap an alternative route to choose it (generous hit box for gloves).
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!map.getLayer('md-alt')) return
      const { x, y } = e.point
      const hits = map.queryRenderedFeatures(
        [
          [x - 20, y - 20],
          [x + 20, y + 20],
        ],
        { layers: ['md-alt'] },
      )
      const idx = hits[0]?.properties?.idx
      if (typeof idx === 'number') latest.current.onSelectRoute(idx)
    })

    // Long-press (touch) or right-click (desktop) drops a destination pin.
    let pressTimer: ReturnType<typeof setTimeout> | null = null
    let pressStart: maplibregl.Point | null = null
    let lastLongPress = 0
    const fireLongPress = (ll: maplibregl.LngLat) => {
      if (Date.now() - lastLongPress < 1000) return
      lastLongPress = Date.now()
      latest.current.onLongPress(ll.lat, ll.lng)
    }
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer)
      pressTimer = null
      pressStart = null
    }
    map.on('touchstart', (e: maplibregl.MapTouchEvent) => {
      cancelPress()
      if (e.originalEvent.touches.length !== 1) return
      pressStart = e.point
      const ll = e.lngLat
      pressTimer = setTimeout(() => fireLongPress(ll), 650)
    })
    map.on('touchmove', (e: maplibregl.MapTouchEvent) => {
      if (pressStart && e.point.dist(pressStart) > 12) cancelPress()
    })
    map.on('touchend', cancelPress)
    map.on('touchcancel', cancelPress)
    map.on('movestart', (e: { originalEvent?: Event }) => {
      if (e.originalEvent) cancelPress()
    })
    map.on('contextmenu', (e: maplibregl.MapMouseEvent) => {
      e.originalEvent.preventDefault() // no browser context menu over the map
      fireLongPress(e.lngLat)
    })

    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map
    const pins = pinsRef.current
    return () => {
      cancelPress()
      map.remove()
      mapRef.current = null
      meRef.current = null
      pins.clear()
      styleLoadedRef.current = false
      hasCenteredRef.current = false
    }
  }, [])

  // Load or swap the style when provider or day/night changes.
  const styleUrl = provider === 'tomtom' ? tomtomStyleUrl(night) : openFreeMapStyleUrl(night)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    styleLoadedRef.current = false
    map.setStyle(styleUrl, {
      diff: false,
      transformStyle: (_prev, next) => withTraffic(next, latest.current.traffic),
    })
  }, [styleUrl])

  // Traffic toggle on an already-loaded style.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    for (const l of map.getStyle()?.layers ?? []) {
      if (isFlowLayer(l)) map.setLayoutProperty(l.id, 'visibility', traffic ? 'visible' : 'none')
    }
  }, [traffic])

  // Route lines.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    ensureRouteLayers(map)
    ;(map.getSource(ROUTE_SRC) as GeoJSONSource).setData(routesGeoJSON(routes, selectedRoute))
  }, [routes, selectedRoute])

  // Destination / stop / pin markers (DOM markers survive style changes).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pins = pinsRef.current
    const keep = new Set<string>()
    for (const m of markers) {
      const key = `${m.kind}|${m.label}|${m.lat}|${m.lon}`
      keep.add(m.id)
      const existing = pins.get(m.id)
      if (existing?.key === key) continue
      existing?.marker.remove()
      const marker = new maplibregl.Marker({ element: markerElement(m), anchor: 'bottom' }).setLngLat([m.lon, m.lat]).addTo(map)
      pins.set(m.id, { marker, key })
    }
    for (const [id, p] of pins) {
      if (!keep.has(id)) {
        p.marker.remove()
        pins.delete(id)
      }
    }
  }, [markers])

  // Zoom to show all routes when a new route set arrives.
  useEffect(() => {
    const map = mapRef.current
    const r = latest.current.routes
    if (!map || fitSeq === 0 || r.length === 0) return
    const b = new maplibregl.LngLatBounds()
    for (const route of r) for (const c of route.geometry) b.extend(c)
    const h = map.getContainer().clientHeight
    map.fitBounds(b, {
      padding: { top: Math.min(140, h * 0.18), bottom: h * 0.55, left: 40, right: 40 },
      pitch: 0,
      bearing: 0,
      maxZoom: 16,
      duration: 800,
    })
  }, [fitSeq])

  // Resize when the map becomes visible or its container changes (Dashboard layout).
  useEffect(() => {
    const map = mapRef.current
    const el = containerRef.current
    if (!map || !el) return
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => mapRef.current?.resize())
    return () => cancelAnimationFrame(id)
  }, [visible])

  // Leaving ride mode: flatten the camera again.
  useEffect(() => {
    const map = mapRef.current
    if (!map || camera === 'ride') return
    if (map.getPitch() > 0 || map.getBearing() !== 0) {
      map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 })
    }
  }, [camera])

  // Own position marker + camera follow.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !fix) return
    const lngLat: [number, number] = [fix.lon, fix.lat]
    if (!meRef.current) {
      const el = document.createElement('div')
      el.className = 'me-marker'
      el.setAttribute('aria-label', 'Your location')
      const arrow = document.createElement('div')
      arrow.className = 'me-marker-arrow'
      el.appendChild(arrow)
      arrowRef.current = arrow
      meRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
        .setLngLat(lngLat)
        .addTo(map)
    } else {
      meRef.current.setLngLat(lngLat)
    }
    const heading = fix.heading ?? (camera === 'ride' ? routeBearing : null)
    if (arrowRef.current) arrowRef.current.style.display = heading == null ? 'none' : 'block'
    if (heading != null) meRef.current.setRotation(heading)

    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true
      if (camera !== 'free') map.jumpTo({ center: lngLat, zoom: 16 })
      return
    }
    if (camera === 'ride') {
      // Heading-up, tilted, rider placed in the lower part of the screen.
      const h = map.getContainer().clientHeight
      map.easeTo({
        center: lngLat,
        bearing: heading ?? map.getBearing(),
        pitch: 50,
        zoom: Math.max(16, Math.min(17.5, 17.5 - ((fix.speedKmh ?? 0) - 30) / 40)),
        padding: { top: h * 0.35, bottom: 0, left: 0, right: 0 },
        duration: 900,
      })
    } else if (camera === 'follow') {
      map.easeTo({ center: lngLat, duration: 800 })
    }
  }, [fix, camera, routeBearing])

  return <div ref={containerRef} className="map" aria-label="Map" />
}
