'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AgentStreamEvent } from '@/types/verification'
import { Cpu, ShieldCheck, Wifi, Zap } from 'lucide-react'

interface AgentCoordinatorStreamProps {
    sessionId?: string
}

const AGENT_BADGES: Record<AgentStreamEvent['agent'], { label: string; icon: React.ReactNode; badgeClass: string }> = {
    Supervisor: {
        label: 'Supervisor Agent',
        icon: <Cpu className="w-4 h-4" />,
        badgeClass: 'bg-cyan-500 text-slate-950',
    },
    Identity: {
        label: 'Identity/Auth Agent',
        icon: <ShieldCheck className="w-4 h-4" />,
        badgeClass: 'bg-emerald-500 text-slate-950',
    },
    Network: {
        label: 'Network Traffic Agent',
        icon: <Wifi className="w-4 h-4" />,
        badgeClass: 'bg-yellow-500 text-slate-950',
    },
}

export function AgentCoordinatorStream({ sessionId = 'soc-session-2027' }: AgentCoordinatorStreamProps) {
    const [events, setEvents] = useState<AgentStreamEvent[]>([])
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const source = new EventSource(`/api/agent-stream?sessionId=${encodeURIComponent(sessionId)}`)

        source.onopen = () => {
            setConnected(true)
            setError(null)
        }

        source.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data) as AgentStreamEvent
                setEvents((prev) => [parsed, ...prev].slice(0, 20))
            } catch (caught) {
                console.error('Failed to parse SSE event', caught)
            }
        }

        source.onerror = () => {
            setError('Connection interrupted. Reconnect to resume agent stream.')
            setConnected(false)
            source.close()
        }

        return () => {
            source.close()
        }
    }, [sessionId])

    const summary = useMemo(() => {
        const counts = events.reduce(
            (acc, current) => {
                acc[current.agent] = (acc[current.agent] ?? 0) + 1
                return acc
            },
            { Supervisor: 0, Identity: 0, Network: 0 } as Record<AgentStreamEvent['agent'], number>
        )
        return counts
    }, [events])

    return (
        <div className="space-y-6">
            <div className="bg-slate-700 rounded-lg border border-slate-600 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-cyan-300">Real-Time Agent Coordination</h2>
                        <p className="text-slate-400 mt-2 text-sm">
                            Supervisor + Identity/Auth + Network agents streaming tool execution and decision reasoning into the SOC dashboard.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200">
                        <Zap className="w-4 h-4 text-yellow-300" />
                        {connected ? 'Live stream active' : 'Awaiting stream'}
                    </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
                        <p className="text-xs uppercase text-slate-500">Supervisor Events</p>
                        <p className="mt-3 text-3xl font-semibold text-cyan-300">{summary.Supervisor}</p>
                    </div>
                    <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
                        <p className="text-xs uppercase text-slate-500">Identity Events</p>
                        <p className="mt-3 text-3xl font-semibold text-emerald-300">{summary.Identity}</p>
                    </div>
                    <div className="rounded-lg border border-slate-600 bg-slate-800 p-4">
                        <p className="text-xs uppercase text-slate-500">Network Events</p>
                        <p className="mt-3 text-3xl font-semibold text-yellow-300">{summary.Network}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-600 bg-slate-800 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-lg font-semibold text-slate-100">Streamed Agent Thought Trail</h3>
                    </div>

                    <div className="space-y-3">
                        {events.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900 p-5 text-slate-400">
                                Waiting for the first agent event to arrive. This stream updates in real time.
                            </div>
                        ) : (
                            events.map((event, index) => {
                                const badge = AGENT_BADGES[event.agent]
                                return (
                                    <div key={`${event.timestamp}-${index}`} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
                                                    <span className={badge.badgeClass}>{badge.icon}</span>
                                                    <span>{badge.label}</span>
                                                </div>
                                                <p className="mt-3 text-sm text-slate-300">{event.message}</p>
                                            </div>
                                            <div className="text-right text-xs text-slate-500">
                                                <div>{event.phase}</div>
                                                <div>{new Date(event.timestamp).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 rounded-xl bg-slate-950/80 px-3 py-2 text-xs text-slate-400">
                                            <span className="font-semibold text-slate-100">Tool step:</span> {event.tool_step}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-600 bg-slate-800 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Wifi className="w-5 h-5 text-yellow-400" />
                        <h3 className="text-lg font-semibold text-slate-100">SOC Coordination Scorecard</h3>
                    </div>

                    <div className="space-y-4 text-sm text-slate-300">
                        <p>
                            The Supervisor-Worker architecture separates identity/auth signal processing from network telemetry and drives a consolidated threat decision stream.
                        </p>
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                            <p className="text-xs uppercase text-slate-500">Current session</p>
                            <p className="mt-2 font-mono text-slate-100">{sessionId}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                            <p className="text-xs uppercase text-slate-500">Threat posture</p>
                            <p className="mt-2 text-slate-100">Mixed — identity evidence and network indicators under active review.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                            <p className="text-xs uppercase text-slate-500">Action readiness</p>
                            <p className="mt-2 text-slate-100">Awaiting human zero-trust approval for containment actions.</p>
                        </div>
                    </div>

                    {error ? (
                        <div className="mt-6 rounded-2xl border border-red-500 bg-red-950/30 p-4 text-sm text-red-200">
                            {error}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
