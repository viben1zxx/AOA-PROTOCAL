'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle, AlertCircle, Zap } from 'lucide-react'

interface ConfidenceMatrixProps {
    /**
     * SAR data quality (0-100)
     * "Deepfake Resistance Level" based on RX algorithm Mahalanobis distance
     */
    sarIntensity: number

    /**
     * Optical data quality (0-100)
     * RGB sensor intensity and consistency
     */
    opticalBrightness: number

    /**
     * Weather/environmental interference (0-100)
     * Cloud cover, atmospheric conditions
     */
    environmentalClarity: number

    /**
     * RX Anomaly Score from Python backend (0-100)
     * Higher = more likely synthetic/deepfaked data
     */
    rxAnomalyScore?: number

    /**
     * Timestamp of last verification
     */
    verificationTime?: string

    /**
     * Classification result
     */
    verificationStatus?: 'VALID' | 'ANOMALY_DETECTED' | 'SYNTHETIC' | 'UNKNOWN'
}

/**
 * Confidence Matrix Component (AOA Protocol V2.0)
 * 
 * Displays institutional users the raw "Truth Data" behind the AI's decision.
 * Shows three verification layers with color-coded status and Mahalanobis distance.
 */
export function ConfidenceMatrix({
    sarIntensity,
    opticalBrightness,
    environmentalClarity,
    rxAnomalyScore = 0,
    verificationTime = new Date().toISOString(),
    verificationStatus = 'UNKNOWN'
}: ConfidenceMatrixProps) {

    // Calculate Deepfake Resistance Level (inverse of RX anomaly score)
    const deepfakeResistanceLevel = Math.max(0, 100 - rxAnomalyScore)

    // Determine status colors based on verification layers
    const getStatusColor = (value: number, isResistanceLevel: boolean = false) => {
        if (isResistanceLevel) {
            // For resistance level: HIGH is GREEN, LOW is RED
            if (value >= 75) return { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-400', label: 'Verified' }
            if (value >= 50) return { bg: 'bg-amber-900/30', border: 'border-amber-600', text: 'text-amber-400', label: 'Anomaly Detected' }
            return { bg: 'bg-red-900/30', border: 'border-red-600', text: 'text-red-400', label: 'Synthetic/Blocked' }
        } else {
            // For quality metrics: HIGH is GREEN, LOW is RED
            if (value >= 70) return { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-400', label: 'Verified' }
            if (value >= 40) return { bg: 'bg-amber-900/30', border: 'border-amber-600', text: 'text-amber-400', label: 'Anomaly Detected' }
            return { bg: 'bg-red-900/30', border: 'border-red-600', text: 'text-red-400', label: 'Synthetic/Blocked' }
        }
    }

    // Layer data with their metrics
    const layers = [
        {
            name: 'Radar (S1)',
            fullName: 'Synthetic Aperture Radar - Sentinel-1',
            value: sarIntensity,
            description: 'VV/VH backscatter intensity analysis',
            icon: 'radar'
        },
        {
            name: 'Optical (S2)',
            fullName: 'Multispectral Imagery - Sentinel-2',
            value: opticalBrightness,
            description: 'RGB and vegetation index metrics',
            icon: 'camera'
        },
        {
            name: 'Environmental',
            fullName: 'Weather & Atmospheric Conditions',
            value: environmentalClarity,
            description: 'Cloud cover, atmospheric interference',
            icon: 'weather'
        }
    ]

    // Determine overall verification status
    const overallStatus = useMemo(() => {
        if (verificationStatus === 'SYNTHETIC') {
            return { color: 'red', icon: 'blocked', message: 'Synthetic/Deepfaked Data Detected' }
        } else if (deepfakeResistanceLevel < 50) {
            return { color: 'red', icon: 'blocked', message: 'Failed RX Anomaly Detection' }
        } else if (verificationStatus === 'ANOMALY_DETECTED') {
            return { color: 'amber', icon: 'warning', message: 'Anomalies Detected' }
        } else if (deepfakeResistanceLevel >= 75) {
            return { color: 'green', icon: 'verified', message: 'All Layers Verified' }
        }
        return { color: 'slate', icon: 'unknown', message: 'Verification Pending' }
    }, [verificationStatus, deepfakeResistanceLevel])

    // Render status icon based on color
    const StatusIcon = ({ color }: { color: string }) => {
        switch (color) {
            case 'green':
                return <CheckCircle className="w-5 h-5 text-green-400" />
            case 'red':
                return <AlertTriangle className="w-5 h-5 text-red-400" />
            case 'amber':
                return <AlertCircle className="w-5 h-5 text-amber-400" />
            default:
                return <Zap className="w-5 h-5 text-slate-400" />
        }
    }

    return (
        <div className="space-y-6">
            {/* Overall Status Banner */}
            <div className={`
                rounded-lg p-6 border-2 transition-all
                ${overallStatus.color === 'green' ? 'bg-green-900/20 border-green-600 shadow-lg shadow-green-600/20' : ''}
                ${overallStatus.color === 'red' ? 'bg-red-900/20 border-red-600 shadow-lg shadow-red-600/20' : ''}
                ${overallStatus.color === 'amber' ? 'bg-amber-900/20 border-amber-600 shadow-lg shadow-amber-600/20' : ''}
                ${overallStatus.color === 'slate' ? 'bg-slate-900/20 border-slate-600' : ''}
            `}>
                <div className="flex items-center gap-4">
                    <StatusIcon color={overallStatus.color} />
                    <div className="flex-1">
                        <div className={`font-semibold text-lg ${overallStatus.color === 'green' ? 'text-green-400' :
                                overallStatus.color === 'red' ? 'text-red-400' :
                                    overallStatus.color === 'amber' ? 'text-amber-400' :
                                        'text-slate-400'
                            }`}>
                            {overallStatus.message}
                        </div>
                        <div className="text-slate-400 text-sm mt-1">
                            Verified at {new Date(verificationTime).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Deepfake Resistance Level (RX Anomaly Detection) */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-cyan-400" />
                            <span className="font-semibold text-white">Deepfake Resistance Level</span>
                        </div>
                        <span className={`text-xl font-bold ${deepfakeResistanceLevel >= 75 ? 'text-green-400' :
                                deepfakeResistanceLevel >= 50 ? 'text-amber-400' :
                                    'text-red-400'
                            }`}>
                            {deepfakeResistanceLevel.toFixed(1)}%
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm">
                        RX Algorithm: Mahalanobis distance analysis | Anomaly Score: {rxAnomalyScore.toFixed(2)}%
                    </p>
                </div>

                {/* Resistance Level Bar */}
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${deepfakeResistanceLevel >= 75 ? 'bg-green-500' :
                                deepfakeResistanceLevel >= 50 ? 'bg-amber-500' :
                                    'bg-red-500'
                            }`}
                        style={{ width: `${Math.min(deepfakeResistanceLevel, 100)}%` }}
                    />
                </div>

                <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>0% (Synthetic)</span>
                    <span>50% (Suspect)</span>
                    <span>100% (Verified)</span>
                </div>
            </div>

            {/* Three Verification Layers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {layers.map((layer) => {
                    const status = getStatusColor(layer.value, false)

                    return (
                        <div
                            key={layer.name}
                            className={`rounded-lg p-4 border-2 transition-all ${status.bg} ${status.border}`}
                        >
                            {/* Layer Name */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-2 h-2 rounded-full ${status.text}`} />
                                <div>
                                    <div className="font-semibold text-white">{layer.name}</div>
                                    <div className="text-xs text-slate-400">{layer.fullName}</div>
                                </div>
                            </div>

                            {/* Quality Score */}
                            <div className="mb-3">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-slate-400 text-sm">Signal Quality</span>
                                    <span className={`text-2xl font-bold ${status.text}`}>
                                        {layer.value.toFixed(0)}%
                                    </span>
                                </div>

                                {/* Quality Bar */}
                                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${layer.value >= 70 ? 'bg-green-500' :
                                                layer.value >= 40 ? 'bg-amber-500' :
                                                    'bg-red-500'
                                            }`}
                                        style={{ width: `${Math.min(layer.value, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Status Label and Description */}
                            <div className="border-t border-slate-700 pt-3">
                                <div className={`text-sm font-medium mb-1 ${status.text}`}>
                                    {status.label}
                                </div>
                                <div className="text-xs text-slate-400">
                                    {layer.description}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Technical Details */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-sm font-semibold text-slate-300 mb-3">Technical Metrics</div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span className="text-slate-400">SAR Backscatter Intensity:</span>
                        <span className="text-cyan-400 font-mono ml-2">{sarIntensity.toFixed(2)} dB</span>
                    </div>
                    <div>
                        <span className="text-slate-400">Optical RGB Brightness:</span>
                        <span className="text-cyan-400 font-mono ml-2">{(opticalBrightness / 100).toFixed(3)}</span>
                    </div>
                    <div>
                        <span className="text-slate-400">Environmental Clarity:</span>
                        <span className="text-cyan-400 font-mono ml-2">{environmentalClarity.toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className="text-slate-400">RX Anomaly Distance:</span>
                        <span className="text-cyan-400 font-mono ml-2">{rxAnomalyScore.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-sm font-semibold text-slate-300 mb-3">Legend</div>
                <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-slate-400">Green: Verified data - Passes all anomaly detection tests</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-slate-400">Amber: Anomaly Detected - RX algorithm flagged statistical outliers</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-slate-400">Red: Synthetic/Blocked - Data failed integrity verification</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
