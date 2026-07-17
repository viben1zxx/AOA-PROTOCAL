'use client'

import React from 'react'
import { VerificationResult } from '@/types/verification'
import { TrendingUp } from 'lucide-react'

interface ReliabilityScoreProps {
    verification: VerificationResult
}

export function ReliabilityScore({ verification }: ReliabilityScoreProps) {
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400'
        if (score >= 60) return 'text-yellow-400'
        if (score >= 40) return 'text-orange-400'
        return 'text-red-400'
    }

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-green-900/20 border-green-700'
        if (score >= 60) return 'bg-yellow-900/20 border-yellow-700'
        if (score >= 40) return 'bg-orange-900/20 border-orange-700'
        return 'bg-red-900/20 border-red-700'
    }

    return (
        <div className={`rounded-lg p-6 border ${getScoreBg(verification.confidence_score)}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200">Reliability Score</h3>
                <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>

            <div className="space-y-4">
                {/* Main Score */}
                <div className="text-center">
                    <div className={`text-5xl font-bold ${getScoreColor(verification.confidence_score)}`}>
                        {verification.confidence_score.toFixed(0)}%
                    </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">SAR Intensity:</span>
                        <span className="text-slate-200">{verification.sar_intensity.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded h-2">
                        <div
                            className="bg-cyan-500 h-2 rounded"
                            style={{ width: `${Math.min(100, (verification.sar_intensity / 100) * 100)}%` }}
                        />
                    </div>

                    <div className="flex justify-between text-sm mt-4">
                        <span className="text-slate-400">Optical Brightness:</span>
                        <span className="text-slate-200">{(verification.optical_brightness * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded h-2">
                        <div
                            className="bg-yellow-500 h-2 rounded"
                            style={{ width: `${verification.optical_brightness * 100}%` }}
                        />
                    </div>

                    <div className="flex justify-between text-sm mt-4">
                        <span className="text-slate-400">Correlation:</span>
                        <span className="text-slate-200">{(verification.correlation * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded h-2">
                        <div
                            className="bg-green-500 h-2 rounded"
                            style={{ width: `${verification.correlation * 100}%` }}
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="mt-4 p-3 bg-slate-800 rounded border border-slate-600">
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="text-slate-200 font-medium">
                        {verification.anomaly_type
                            ? `⚠️ ${verification.anomaly_type}`
                            : '✓ Physical Asset Verified'}
                    </p>
                </div>
            </div>
        </div>
    )
}
