'use client'

import React, { useState } from 'react'
import { ContainmentActionType, ProofReport, VerificationResult } from '@/types/verification'
import { Download, FileText, Lock } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import toast from 'react-hot-toast'

interface ReportGeneratorProps {
    verifications: VerificationResult[]
    onGenerateReport: (result: VerificationResult) => Promise<ProofReport>
}

export function ReportGenerator({ verifications, onGenerateReport }: ReportGeneratorProps) {
    const [selectedVerification, setSelectedVerification] = useState<number | null>(null)
    const [generatingReport, setGeneratingReport] = useState(false)
    const [executingAction, setExecutingAction] = useState(false)
    const [selectedGuardrailAction, setSelectedGuardrailAction] = useState<ContainmentActionType | null>(null)
    const [guardrailMessage, setGuardrailMessage] = useState<string | null>(null)

    const handleGenerateReport = async () => {
        if (selectedVerification === null) {
            toast.error('Please select a verification')
            return
        }

        const verification = verifications[selectedVerification]
        setGeneratingReport(true)

        try {
            const report = await onGenerateReport(verification)

            // Download JSON certificate
            const jsonBlob = new Blob([JSON.stringify(report, null, 2)], {
                type: 'application/json',
            })
            const url = URL.createObjectURL(jsonBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `proof-of-reality-${verification.verification_hash.substring(0, 8)}.json`
            a.click()

            toast.success('Proof-of-Reality report generated!')
        } catch (error) {
            toast.error('Failed to generate report')
            console.error(error)
        } finally {
            setGeneratingReport(false)
        }
    }

    const handleExecuteContainment = async (action: ContainmentActionType) => {
        if (selectedVerification === null) {
            toast.error('Select a verification before executing containment')
            return
        }

        const verification = verifications[selectedVerification]
        setExecutingAction(true)
        setSelectedGuardrailAction(action)
        setGuardrailMessage(null)

        try {
            const response = await apiClient.submitContainmentAction({
                verification_hash: verification.verification_hash,
                action,
                requested_by: 'SOC Analyst',
                approval_signatures: ['analyst-001', 'reviewer-002'],
                timestamp: new Date().toISOString(),
                context: `Manual override triggered from report generator for ${verification.verification_hash}`,
            })

            setGuardrailMessage(response.message)
            toast.success('Containment action queued for Zero-Trust review')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Containment action failed'
            setGuardrailMessage(message)
            toast.error(message)
        } finally {
            setExecutingAction(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Report Generator */}
            <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <h3 className="text-xl font-bold mb-4 text-cyan-400 flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    Proof-of-Reality Report Generator
                </h3>

                <p className="text-slate-400 mb-4">
                    Generate cryptographically signed verification reports for use in insurance claims, legal proceedings, or contract settlement.
                </p>

                {/* Verification List */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Select Verification
                    </label>
                    <select
                        aria-label="Select verification"
                        value={selectedVerification ?? ''}
                        onChange={(e) => setSelectedVerification(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                    >
                        <option value="">Choose a verification...</option>
                        {verifications.map((v, idx) => (
                            <option key={idx} value={idx}>
                                {v.location[0].toFixed(4)}, {v.location[1].toFixed(4)} - {v.timestamp}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport || selectedVerification === null}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                    {generatingReport ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Download className="w-5 h-5" />
                            Generate & Download Report
                        </>
                    )}
                </button>
            </div>

            {/* Report Details Template */}
            {selectedVerification !== null && (
                <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                    <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-green-400" />
                        Report Contents
                    </h4>

                    <div className="bg-slate-800 rounded p-4 space-y-3 text-sm text-slate-300 font-mono">
                        <div>
                            <span className="text-cyan-400">Verification Hash:</span><br />
                            {verifications[selectedVerification].verification_hash}
                        </div>

                        <div>
                            <span className="text-cyan-400">Physical Status:</span><br />
                            {verifications[selectedVerification].is_physical ? '✓ VERIFIED' : '✗ ANOMALY'}
                        </div>

                        <div>
                            <span className="text-cyan-400">Confidence Score:</span><br />
                            {verifications[selectedVerification].confidence_score.toFixed(2)}%
                        </div>

                        <div>
                            <span className="text-cyan-400">Cryptographic Signature:</span><br />
                            <span className="text-yellow-400">0x[SIGNATURE]</span>
                        </div>

                        <div>
                            <span className="text-cyan-400">Timestamp:</span><br />
                            {verifications[selectedVerification].timestamp}
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded text-xs text-blue-200">
                        💼 This report can be used as legal evidence in insurance claims, commodity trading, and contract settlement procedures.
                    </div>
                </div>
            )}

            {selectedVerification !== null && verifications[selectedVerification].anomaly_type !== null && verifications[selectedVerification].confidence_score >= 85 && (
                <div className="bg-slate-700 rounded-lg border border-amber-500 p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h4 className="text-lg font-semibold text-amber-300">Action Guardrail</h4>
                            <p className="text-slate-400 text-sm mt-1">
                                High-confidence containment recommendations require zero-trust approval before execution.
                            </p>
                        </div>
                        <div className="rounded-full border border-amber-500 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                            Multi-Sig Ready
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {(['isolate-host', 'revoke-token', 'rotate-api-keys'] as ContainmentActionType[]).map((action) => (
                            <button
                                key={action}
                                type="button"
                                onClick={() => handleExecuteContainment(action)}
                                disabled={executingAction}
                                className={`rounded-2xl border px-4 py-3 text-left transition ${selectedGuardrailAction === action ? 'border-amber-400 bg-amber-500/10' : 'border-slate-600 bg-slate-800 hover:border-amber-300'} ${executingAction ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                            >
                                <div className="text-sm font-semibold text-slate-100 capitalize">{action.replace('-', ' ')}</div>
                                <div className="mt-2 text-xs text-slate-400">{action === 'isolate-host' ? 'Isolate the host from the environment' : action === 'revoke-token' ? 'Revoke the active API token' : 'Rotate compromised API keys automatically'}</div>
                            </button>
                        ))}
                    </div>

                    {guardrailMessage ? (
                        <div className="mt-4 rounded-2xl border border-slate-600 bg-slate-900/80 p-4 text-sm text-slate-200">
                            <span className="font-medium text-amber-300">Containment Response:</span> {guardrailMessage}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Recent Reports */}
            <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <h4 className="font-semibold text-slate-200 mb-4">Recent Reports</h4>

                {verifications.length === 0 ? (
                    <p className="text-slate-400 text-sm">No verifications available yet</p>
                ) : (
                    <div className="space-y-2">
                        {verifications.slice(0, 5).map((v, idx) => (
                            <div
                                key={idx}
                                className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-600 hover:border-cyan-500 transition-colors cursor-pointer"
                                onClick={() => setSelectedVerification(idx)}
                            >
                                <div>
                                    <p className="text-sm text-slate-200">
                                        {v.location[0].toFixed(4)}°, {v.location[1].toFixed(4)}°
                                    </p>
                                    <p className="text-xs text-slate-400">{v.timestamp}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${v.is_physical
                                    ? 'bg-green-900 text-green-200'
                                    : 'bg-red-900 text-red-200'
                                    }`}>
                                    {v.is_physical ? 'Valid' : 'Anomaly'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
