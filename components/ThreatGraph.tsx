'use client'

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force'
import { VerificationResult, ThreatEdge, ThreatNode } from '@/types/verification'
import { Layers, ShieldAlert, Wifi } from 'lucide-react'

interface ThreatGraphProps {
    verifications: VerificationResult[]
}

function buildThreatGraph(verifications: VerificationResult[]) {
    const nodes: ThreatNode[] = [
        { id: 'attacker', label: 'Suspicious IP', type: 'ip', risk: 'critical' },
    ]
    const edges: ThreatEdge[] = []

    verifications.slice(0, 4).forEach((verification, index) => {
        const hostId = `host-${index}`
        const userId = `user-${index}`
        const fileId = `file-${index}`
        const dbId = `db-${index}`
        const risk = verification.confidence_score > 90 ? 'critical' : verification.confidence_score > 75 ? 'high' : 'medium'

        nodes.push(
            {
                id: hostId,
                label: `Server-${index + 1}`,
                type: 'host',
                risk,
            },
            {
                id: userId,
                label: verification.anomaly_type ? `User-${verification.anomaly_type}` : `User-${index + 1}`,
                type: 'user',
                risk: verification.anomaly_type ? 'high' : 'medium',
            },
            {
                id: fileId,
                label: `File-${index + 1}`,
                type: 'file',
                risk: verification.anomaly_type ? 'high' : 'medium',
            },
            {
                id: dbId,
                label: `Database-${Math.min(index + 1, 3)}`,
                type: 'database',
                risk: verification.is_physical ? 'medium' : 'high',
            }
        )

        edges.push(
            { id: `edge-attacker-host-${index}`, source: 'attacker', target: hostId, relation: 'pivoted to' },
            { id: `edge-host-user-${index}`, source: hostId, target: userId, relation: 'authenticated as' },
            { id: `edge-user-file-${index}`, source: userId, target: fileId, relation: 'accessed' },
            { id: `edge-file-db-${index}`, source: fileId, target: dbId, relation: 'exfiltrate to' }
        )
    })

    return { nodes, edges }
}

function getNodeDecoration(type: ThreatNode['type']) {
    switch (type) {
        case 'attacker':
            return 'bg-red-600 text-white'
        case 'ip':
            return 'bg-red-700 text-white'
        case 'user':
            return 'bg-yellow-500 text-slate-950'
        case 'host':
            return 'bg-cyan-500 text-slate-950'
        case 'file':
            return 'bg-violet-500 text-slate-950'
        case 'database':
            return 'bg-emerald-500 text-slate-950'
        default:
            return 'bg-slate-600 text-white'
    }
}

function getNodeColorClass(type: ThreatNode['type']) {
    switch (type) {
        case 'attacker':
        case 'ip':
            return 'text-rose-500'
        case 'user':
            return 'text-yellow-400'
        case 'host':
            return 'text-cyan-400'
        case 'file':
            return 'text-violet-400'
        case 'database':
            return 'text-emerald-400'
        default:
            return 'text-slate-400'
    }
}

export function ThreatGraph({ verifications }: ThreatGraphProps) {
    const { nodes, edges } = useMemo(() => buildThreatGraph(verifications), [verifications])
    const [hoveredNode, setHoveredNode] = useState<string | null>(null)
    const [selectedNode, setSelectedNode] = useState<ThreatNode | null>(null)

    const getConnectedNodeIds = useCallback(
        (nodeId: string) => {
            const connected = new Set<string>()
            edges.forEach((e) => {
                if (e.source === nodeId) connected.add(e.target)
                if (e.target === nodeId) connected.add(e.source)
            })
            return connected
        },
        [edges]
    )

    // Force graph setup
    type SimNode = ThreatNode & SimulationNodeDatum
    type SimLink = ThreatEdge & SimulationLinkDatum<SimNode>

    const svgRef = useRef<SVGSVGElement | null>(null)
    const [simNodes, setSimNodes] = useState<SimNode[]>(() => nodes.map((n) => ({ ...n } as SimNode)))
    const [simLinks, setSimLinks] = useState<SimLink[]>(() => edges.map((e) => ({ ...e } as SimLink)))
    const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
    // Pan & zoom state for SVG
    const [scale, setScale] = useState(1)
    const [tx, setTx] = useState(0)
    const [ty, setTy] = useState(0)
    const isPanning = useRef(false)
    const panStart = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        // Create fresh copies to avoid mutating props
        const sNodes: SimNode[] = nodes.map((n) => ({ ...n } as SimNode))
        const sLinks: SimLink[] = edges.map((e) => ({ ...e } as SimLink))

        setSimNodes(sNodes)
        setSimLinks(sLinks)

        // Initialize simulation
        if (simRef.current) {
            simRef.current.stop()
            simRef.current = null
        }

        const simulation = forceSimulation<SimNode, SimLink>(sNodes)
            .force('link', forceLink<SimNode, SimLink>(sLinks).id((d: any) => d.id).distance(60).strength(0.8))
            .force('charge', forceManyBody<SimNode>().strength(-140))
            .force('center', forceCenter<SimNode>(200, 160))
            .force('collide', forceCollide<SimNode>().radius(24))

        simulation.on('tick', () => {
            // update shallow copies to trigger React render
            setSimNodes((prev) => prev.map((n, i) => ({ ...n, x: sNodes[i].x, y: sNodes[i].y } as SimNode)))
        })

        simRef.current = simulation

        return () => {
            simulation.stop()
            simRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes.length, edges.length])

    // Handlers for pan & zoom
    const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.95 : 1.05
        setScale((s) => Math.min(3, Math.max(0.5, +(s * factor).toFixed(3))))
    }

    const toClient = (clientX: number, clientY: number) => ({ x: clientX, y: clientY })

    const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        isPanning.current = true
        panStart.current = toClient(e.clientX, e.clientY)
    }

    const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isPanning.current || !panStart.current) return
        const cur = toClient(e.clientX, e.clientY)
        const dx = cur.x - panStart.current.x
        const dy = cur.y - panStart.current.y
        setTx((t) => t + dx)
        setTy((t) => t + dy)
        panStart.current = cur
    }

    const onMouseUp = () => {
        isPanning.current = false
        panStart.current = null
    }

    const zoomIn = () => setScale((s) => Math.min(3, +(s * 1.15).toFixed(3)))
    const zoomOut = () => setScale((s) => Math.max(0.5, +(s * 0.85).toFixed(3)))
    const resetView = () => {
        setScale(1)
        setTx(0)
        setTy(0)
    }

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-slate-600 bg-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Layers className="w-5 h-5 text-cyan-300" />
                    <div>
                        <h2 className="text-2xl font-semibold text-slate-100">Threat Relationship Mapper</h2>
                        <p className="text-slate-400 text-sm">
                            Node-based lateral movement visualization for SOC analysts and incident response teams.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-600 bg-slate-900 p-4">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold"> <ShieldAlert className="w-4 h-4 text-amber-300" /> Blast Radius</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                            Each verification becomes a chained threat path from Suspicious IP into host, user, file and database layers. This layout abstracts real infrastructure laterality.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-600 bg-slate-900 p-4">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold"> <Wifi className="w-4 h-4 text-cyan-300" /> Analysis Signals</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{verifications.length} verification footprints analyzed for policy-driven attack surface exposure.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-600 bg-slate-900 p-4">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold"> <ShieldAlert className="w-4 h-4 text-red-400" /> High Confidence Threats</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                            {verifications.filter((v) => v.confidence_score > 85).length} high-confidence lateral-risk events detected.
                        </p>
                    </div>
                </div>
            </div>

            {verifications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-600 bg-slate-900 p-6 text-slate-400">
                    Threat graph requires at least one verification record. Complete a scan to seed the relationship mapper.
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-lg border border-slate-600 bg-slate-800 p-6">
                        <h3 className="text-lg font-semibold text-slate-100 mb-4">Interactive Graph</h3>
                        <div className="grid gap-3">
                            <div className="relative rounded-2xl border border-slate-700 bg-slate-950 p-2">
                                <div className="absolute right-3 top-3 z-10 inline-flex flex-col rounded-2xl border border-slate-700 bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm">
                                    <button type="button" onClick={zoomIn} className="px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 rounded-lg transition">
                                        + Zoom In
                                    </button>
                                    <button type="button" onClick={zoomOut} className="mt-2 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 rounded-lg transition">
                                        - Zoom Out
                                    </button>
                                    <button type="button" onClick={resetView} className="mt-2 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 rounded-lg transition">
                                        Reset
                                    </button>
                                </div>
                                <div className="absolute left-3 bottom-3 z-10 rounded-2xl border border-slate-700 bg-slate-900/90 p-3 text-xs text-slate-300 shadow-xl backdrop-blur-sm">
                                    <div className="font-semibold text-slate-100 mb-2">Interactions</div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-400" />Drag to pan</div>
                                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Scroll to zoom</div>
                                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-200" />Double-click to reset</div>
                                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" />Pulse shows selected edge</div>
                                    </div>
                                </div>
                                <svg ref={svgRef} viewBox="0 0 400 320" className="w-full h-80 cursor-grab" onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onDoubleClick={resetView}>
                                    <g transform={`translate(${tx},${ty}) scale(${scale})`}>
                                        {simLinks.map((link) => {
                                            const sx = (link.source as SimNode).x ?? 200
                                            const sy = (link.source as SimNode).y ?? 160
                                            const tx = (link.target as SimNode).x ?? 220
                                            const ty = (link.target as SimNode).y ?? 160
                                            const highlighted = hoveredNode && ((link.source as SimNode).id === hoveredNode || (link.target as SimNode).id === hoveredNode)
                                            return (
                                                <line
                                                    key={link.id}
                                                    x1={sx}
                                                    y1={sy}
                                                    x2={tx}
                                                    y2={ty}
                                                    strokeWidth={highlighted ? 2.6 : 1.2}
                                                    stroke={highlighted ? '#06b6d4' : '#334155'}
                                                    strokeOpacity={highlighted ? 0.95 : 0.8}
                                                    strokeDasharray="8 5"
                                                    className="transition-all duration-200"
                                                >
                                                    <animate attributeName="stroke-dashoffset" from="0" to={highlighted ? '40' : '20'} dur={highlighted ? '1s' : '2.5s'} repeatCount="indefinite" />
                                                </line>
                                            )
                                        })}

                                        {simNodes.map((n) => {
                                            const cx = n.x ?? 200
                                            const cy = n.y ?? 160
                                            const isDim = hoveredNode && hoveredNode !== n.id && !getConnectedNodeIds(hoveredNode).has(n.id)
                                            const colorClass = getNodeColorClass(n.type)
                                            return (
                                                <g key={n.id} transform={`translate(${cx},${cy})`} className={`cursor-pointer transition-all duration-150 ${isDim ? 'opacity-40' : 'opacity-100'}`} onMouseEnter={() => setHoveredNode(n.id)} onMouseLeave={() => setHoveredNode((h) => (h === n.id ? null : h))} onClick={() => setSelectedNode(n)}>
                                                    <g className={`${colorClass} fill-current`}>
                                                        <circle r={12} stroke="#0f172a" strokeWidth={2} />
                                                    </g>
                                                    <text x={18} y={6} className="text-xs fill-slate-200" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{n.label}</text>
                                                </g>
                                            )
                                        })}
                                    </g>
                                </svg>
                            </div>

                            {nodes.map((node) => {
                                const connected = hoveredNode ? getConnectedNodeIds(hoveredNode) : null
                                const isConnected = hoveredNode ? connected!.has(node.id) || node.id === hoveredNode : false
                                const dimmed = hoveredNode && !isConnected
                                const isSelected = selectedNode?.id === node.id

                                return (
                                    <div
                                        key={node.id}
                                        role="button"
                                        tabIndex={0}
                                        onMouseEnter={() => setHoveredNode(node.id)}
                                        onMouseLeave={() => setHoveredNode((h) => (h === node.id ? null : h))}
                                        onClick={() => setSelectedNode(node)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') setSelectedNode(node)
                                            if (e.key === 'Escape') setSelectedNode(null)
                                        }}
                                        className={`rounded-2xl border p-4 bg-slate-950 transition-all duration-150 transform ${dimmed ? 'opacity-40 scale-98' : 'opacity-100'} ${isSelected ? 'ring-2 ring-cyan-400 scale-105' : 'border-slate-700'} hover:scale-102`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getNodeDecoration(node.type)}`}>
                                                {node.type.toUpperCase()}
                                            </span>
                                            <span className={`text-xs uppercase tracking-[0.18em] ${node.risk === 'critical' ? 'text-rose-300 animate-pulse' : 'text-slate-500'}`}>{node.risk}</span>
                                        </div>
                                        <div className="mt-3 text-sm text-slate-200 flex items-start justify-between gap-3">
                                            <div>{node.label}</div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigator.clipboard?.writeText(node.label)
                                                }}
                                                className="ml-3 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                                aria-label={`Copy ${node.label}`}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    {selectedNode && (
                        <div className="fixed right-6 bottom-6 z-40 w-80 md:w-96 rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-lg">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm text-slate-400">Details</div>
                                    <div className="text-lg font-semibold text-slate-100 mt-1">{selectedNode.label}</div>
                                    <div className="text-xs text-slate-500 mt-2">Type: <span className="font-medium text-slate-200">{selectedNode.type}</span></div>
                                    <div className="text-xs text-slate-500">Risk: <span className={`font-medium ${selectedNode.risk === 'critical' ? 'text-rose-300' : 'text-slate-200'}`}>{selectedNode.risk}</span></div>
                                </div>
                                <div>
                                    <button onClick={() => setSelectedNode(null)} className="text-sm text-slate-400 hover:text-slate-200">Close</button>
                                </div>
                            </div>
                            <div className="mt-3 text-sm text-slate-300">
                                Connected to: {Array.from(getConnectedNodeIds(selectedNode.id)).join(', ') || 'None'}
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg border border-slate-600 bg-slate-800 p-6">
                        <h3 className="text-lg font-semibold text-slate-100 mb-4">Relationships</h3>
                        <div className="space-y-3">
                            {edges.map((edge) => (
                                <div key={edge.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                                    <div className="text-sm text-slate-300">{edge.source.replace(/[-_]/g, ' ')} <span className="text-cyan-300">{edge.relation}</span> {edge.target.replace(/[-_]/g, ' ')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
