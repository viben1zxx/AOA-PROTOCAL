'use client'

import React, { useState } from 'react'
import { ContainmentActionType, VerificationResult } from '@/types/verification'
import { apiClient } from '@/lib/apiClient'
import { ReliabilityScore } from './ReliabilityScore'
import { useVerificationStore } from '@/store/verificationStore'
import { Loader } from 'lucide-react'
import toast from 'react-hot-toast'

interface VerificationPanelProps {
    location: [number, number]
    verifications: VerificationResult[]
}

export function VerificationPanel({ location, verifications }: VerificationPanelProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [approvedAction, setApprovedAction] = useState<ContainmentActionType | null>(null)
    const [approvalStep, setApprovalStep] = useState<'idle' | 'requested' | 'confirmed'>('idle')
    const [containmentMessage, setContainmentMessage] = useState<string | null>(null)
    const [executingAction, setExecutingAction] = useState(false)
    const { initiateVerification } = useVerificationStore()

    const nearbyVerifications = verifications.filter(v => {
        const distance = Math.sqrt(
            Math.pow(v.location[0] - location[0], 2) +
            Math.pow(v.location[1] - location[1], 2)
        )
        return distance < 0.1 // Within ~11km
    })

    const alertingVerification = nearbyVerifications
        .filter((result) => result.anomaly_type !== null || result.confidence_score > 88)
        .sort((a, b) => b.confidence_score - a.confidence_score)[0] ?? null

    const handleScan = async () => {
        setIsScanning(true)
        try {
            await initiateVerification(location[0], location[1])
        } finally {
            setIsScanning(false)
        }
    }

    const handleRequestApproval = (action: ContainmentActionType) => {
        setApprovedAction(action)
        setApprovalStep('requested')
        setContainmentMessage(`Approval requested for ${action.replace('-', ' ')}`)
    }

    const handleConfirmOverride = async () => {
        if (!alertingVerification || !approvedAction) {
            toast.error('Select an action before confirming override')
            return
        }

        setExecutingAction(true)
        try {
            const response = await apiClient.submitContainmentAction({
                verification_hash: alertingVerification.verification_hash,
                action: approvedAction,
                requested_by: 'SOC Analyst',
                approval_signatures: ['analyst-001', 'architect-002'],
                timestamp: new Date().toISOString(),
                context: `Zero-Trust override requested for anomaly ${alertingVerification.anomaly_type ?? 'unknown'}`,
            })

            setApprovalStep('confirmed')
            setContainmentMessage(response.message)
            toast.success('Zero-Trust override confirmed and submitted')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Override submission failed'
            setContainmentMessage(message)
            toast.error(message)
        } finally {
            setExecutingAction(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Location Info */}
            <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <h2 className="text-xl font-bold mb-4 text-cyan-400">Verification Panel</h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Latitude</p>
                        <p className="text-lg font-mono text-slate-200">{location[0].toFixed(6)}°</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Longitude</p>
                        <p className="text-lg font-mono text-slate-200">{location[1].toFixed(6)}°</p>
                    </div>
                </div>

                {/* Scan Button */}
                <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                    {isScanning ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Scanning Satellites...
                        </>
                    ) : (
                        <>
                            🛰️ Initiate Satellite Verification
                        </>
                    )}
                </button>
            </div>

            {/* Nearby Verifications */}
            {nearbyVerifications.length > 0 ? (
                <div>
                    <h3 className="text-lg font-bold mb-4 text-slate-200">Nearby Verification Results</h3>
                    <div className="space-y-4">
                        {nearbyVerifications.map((v, idx) => (
                            <ReliabilityScore key={idx} verification={v} />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-700 rounded-lg p-6 border border-slate-600 text-center">
                    <p className="text-slate-400">No verifications found nearby</p>
                    <p className="text-xs text-slate-500 mt-2">Run a scan to initiate satellite data collection</p>
                </div>
            )}

            {alertingVerification && (
                <div className="rounded-lg border border-amber-500 bg-slate-900 p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-xl font-semibold text-amber-300">Zero-Trust Containment Guardrail</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                High-confidence lateral movement detected. Choose an action and confirm multi-signature override.
                            </p>
                        </div>
                        <div className="rounded-full border border-amber-500 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                            {approvalStep === 'confirmed' ? 'Override Confirmed' : approvalStep === 'requested' ? 'Approval Requested' : 'Awaiting Action'}
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {(['isolate-host', 'revoke-token', 'rotate-api-keys'] as ContainmentActionType[]).map((action) => (
                            <button
                                key={action}
                                type="button"
                                onClick={() => handleRequestApproval(action)}
                                className={`rounded-2xl border px-4 py-3 text-left transition ${approvedAction === action ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800 hover:border-amber-300'} text-slate-100`}
                            >
                                <div className="text-sm font-semibold capitalize">{action.replace('-', ' ')}</div>
                                <div className="mt-2 text-xs text-slate-400">{action === 'isolate-host' ? 'Segment the host from the network' : action === 'revoke-token' ? 'Revoke current session credentials' : 'Rotate all exposed API keys'}</div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-sm text-slate-300">
                            <p className="font-medium text-slate-100">Selected Action</p>
                            <p className="mt-2">{approvedAction ? approvedAction.replace('-', ' ') : 'None selected'}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleConfirmOverride}
                            disabled={!approvedAction || executingAction || approvalStep === 'confirmed'}
                            className={`rounded-2xl px-5 py-3 font-semibold transition ${!approvedAction || executingAction || approvalStep === 'confirmed' ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-amber-400 text-slate-950 hover:bg-amber-300'}`}
                        >
                            {executingAction ? 'Submitting override...' : 'Confirm Multi-Sig Override'}
                        </button>
                    </div>

                    {containmentMessage ? (
                        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/90 p-4 text-sm text-slate-200">
                            <span className="font-medium text-amber-300">Containment status:</span> {containmentMessage}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
