'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl, { Map } from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { VerificationResult } from '@/types/verification'
import { } from 'lucide-react'

interface GlobalMapProps {
    onLocationSelect: (lat: number, lon: number) => void
    verifications: VerificationResult[]
    loading: boolean
}

export function GlobalMap({ onLocationSelect, verifications, loading }: GlobalMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<Map | null>(null)
    const draw = useRef<MapboxDraw | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [mapReady, setMapReady] = useState(false)

    useEffect(() => {
        if (!mapContainer.current) return

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [0, 20],
            zoom: 2,
            pitch: 0,
        })

        draw.current = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: true,
            },
        })

        map.current.addControl(draw.current)

        map.current.on('load', () => {
            setMapReady(true)
            map.current?.addSource('verifications', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: verifications.map((v) => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [v.location[1], v.location[0]] },
                        properties: { is_physical: v.is_physical, confidence: v.confidence_score, anomaly_type: v.anomaly_type },
                    })),
                },
            })

            map.current?.addLayer({
                id: 'physical-assets',
                type: 'circle',
                source: 'verifications',
                filter: ['==', ['get', 'is_physical'], true],
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#10b981',
                    'circle-opacity': 0.95,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#062018',
                },
            })

            map.current?.addLayer({
                id: 'anomalies',
                type: 'circle',
                source: 'verifications',
                filter: ['==', ['get', 'is_physical'], false],
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#f43f5e',
                    'circle-opacity': 0.95,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#2b0210',
                },
            })

            // Click handlers
            map.current?.on('click', 'physical-assets', (e) => {
                const feature = e.features?.[0]
                if (feature?.geometry.type === 'Point') {
                    const [lon, lat] = feature.geometry.coordinates as [number, number]
                    onLocationSelect(lat, lon)
                }
            })

            map.current?.on('click', 'anomalies', (e) => {
                const feature = e.features?.[0]
                if (feature?.geometry.type === 'Point') {
                    const [lon, lat] = feature.geometry.coordinates as [number, number]
                    onLocationSelect(lat, lon)
                }
            })

            // Cursor interactions
            map.current?.on('mouseenter', 'physical-assets', () => map.current && (map.current.getCanvas().style.cursor = 'pointer'))
            map.current?.on('mouseleave', 'physical-assets', () => map.current && (map.current.getCanvas().style.cursor = ''))
        })

        map.current.on('draw.create', updatePolygon)
        map.current.on('draw.update', updatePolygon)
        map.current.on('draw.delete', updatePolygon)

        return () => map.current?.remove()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!map.current || !mapReady) return
        const source = map.current.getSource('verifications') as mapboxgl.GeoJSONSource | undefined
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: verifications.map((v) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.location[1], v.location[0]] }, properties: { is_physical: v.is_physical, confidence: v.confidence_score, anomaly_type: v.anomaly_type } })),
            })
        }
    }, [verifications, mapReady])

    const updatePolygon = () => {
        const data = draw.current?.getAll()
        if (data && data.features.length > 0) {
            const feature = data.features[0]
            if (feature.geometry.type === 'Polygon') {
                const coordinates = feature.geometry.coordinates[0] as [number, number][]
                const centroid = calculateCentroid(coordinates)
                onLocationSelect(centroid[1], centroid[0])
            }
        }
    }

    const calculateCentroid = (coords: [number, number][]): [number, number] => {
        let sumX = 0
        let sumY = 0
        for (const [x, y] of coords) {
            sumX += x
            sumY += y
        }
        return [sumX / coords.length, sumY / coords.length]
    }

    return (
        <div className="space-y-4">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
                <p className="text-sm text-slate-300">🎯 Click points or draw a polygon to fence an area and initiate verification</p>
                <div className="inline-flex items-center gap-2">
                    <button
                        onClick={() => setIsDrawing(!isDrawing)}
                        aria-pressed={!!isDrawing}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg text-slate-200 ${isDrawing ? 'bg-cyan-600 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'} transition-all duration-150`}
                    >
                        {isDrawing ? '✓ Drawing' : '✏️ Digital Fence'}
                    </button>
                </div>
            </div>

            <div className="relative rounded-lg overflow-hidden border border-slate-800">
                <div ref={mapContainer} className="w-full h-96 md:h-[640px]" />
                {loading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 text-slate-100">Loading verification data...</div>}
            </div>

            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                <h3 className="font-semibold mb-3 text-slate-100">Legend</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-400/20" />
                        <div>
                            <div className="text-sm text-slate-300">Physical Asset Verified</div>
                            <div className="text-xs text-slate-500">Trusted on-sensor validation</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-400/20" />
                        <div>
                            <div className="text-sm text-slate-300">Synthetic Anomaly Detected</div>
                            <div className="text-xs text-slate-500">Automated anomaly score & RX flag</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-yellow-400 ring-2 ring-yellow-300/20" />
                        <div>
                            <div className="text-sm text-slate-300">Pending Verification</div>
                            <div className="text-xs text-slate-500">Queued for human review</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
