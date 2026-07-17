'use client'

import { useState, useEffect } from 'react'
import {
    Activity,
    Database,
    Eye,
    Globe,
    Layers,
    Lock,
    Monitor,
    Radio,
    Satellite,
    ShieldAlert,
    Terminal,
    RefreshCw,
    Search,
    ChevronRight,
} from 'lucide-react'

export default function AOADashboard() {
    const [currentTime, setCurrentTime] = useState(new Date())
    const [refreshing, setRefreshing] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const handleRefresh = () => {
        setRefreshing(true)
        setTimeout(() => setRefreshing(false), 1000)
    }

    const orbitalFeeds = [
        { id: 'S1-SAR', name: 'Sentinel-1 (SAR)', status: 'Synchronized', type: 'Radar', latency: '42ms' },
        { id: 'S2-OPT', name: 'Sentinel-2 (Optical)', status: 'Verifying', type: 'Visual', latency: '128ms' },
        { id: 'AIS-MT', name: 'AIS Marine Transponders', status: 'Anomaly Detected', type: 'Radio', latency: '12ms' },
        { id: 'LAND-8', name: 'Landsat 8', status: 'Synchronized', type: 'Multispectral', latency: '240ms' },
    ]

    const verificationLogs = [
        { time: '14:22:01', msg: 'Coordinate 34.0522° N: SAR mass density matches Optical profile. Confidence 98.4%', status: 'success' },
        { time: '14:21:45', msg: 'Cross-referencing Vessel ID 4219902 with Sentinel-1 SAR signature...', status: 'info' },
        { time: '14:21:12', msg: 'Anomaly detected at Lat: -12.45, Long: 130.84. AIS active, SAR density null.', status: 'warning' },
        { time: '14:20:58', msg: 'Reality Oracle: Checksum match for Block #8829102. Escrow triggered.', status: 'success' },
        { time: '14:20:33', msg: 'Optical feed degradation detected in Sector 7G. Re-routing via Sentinel-3.', status: 'info' },
    ]

    const triggerMatrix = [
        { id: 'ESC-402', target: '40.7128° N, 74.0060° W', value: '42.5 ETH', status: 'Pending', fee: '0.0425 ETH' },
        { id: 'ESC-403', target: '35.6762° N, 139.6503° E', value: '120,000 USDC', status: 'Settled', fee: '120 USDC' },
        { id: 'ESC-404', target: '51.5074° N, 0.1278° W', value: '15.0 ETH', status: 'Active', fee: '0.015 ETH' },
        { id: 'ESC-405', target: '22.3193° N, 114.1694° E', value: '88,000 USDT', status: 'Disputed', fee: '88 USDT' },
    ]

    const anomalies = [
        { level: 'Critical', source: 'Vessel AIS', detail: 'Vessel AIS active, SAR density null - Potential Synthetic Spoofing Detected', location: 'Atlantic Sector 4' },
        { level: 'Warning', source: 'Sentinel-2', detail: 'Spectral signature mismatch in grain elevator thermal scan.', location: 'Ukraine, Port of Odessa' },
    ]

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

            <header className="relative z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-md opacity-20 animate-pulse" />
                        <Satellite className="h-8 w-8 text-cyan-400 relative" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tighter text-white uppercase flex items-center gap-2">
                            AOA <span className="text-cyan-500">Autonomous Orbital Auditor</span>
                        </h1>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                            <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                SYSTEM: OPERATIONAL
                            </span>
                            <span className="text-slate-400">{mounted ? currentTime.toISOString() : ''}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="h-8 w-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">
                                <Monitor className="h-4 w-4 text-slate-400" />
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="p-2 rounded border border-slate-800 hover:bg-slate-900 transition-colors group"
                    >
                        <RefreshCw className={`h-4 w-4 text-slate-400 group-hover:text-cyan-400 transition-all ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
                    </button>
                </div>
            </header>

            <main className="relative z-10 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Escrow Volume Locked', val: '$428.4M', icon: Lock, color: 'text-cyan-400' },
                        { label: 'Active Satellite Feeds', val: '24/24', icon: Satellite, color: 'text-emerald-400' },
                        { label: 'Daily Settlement Fees', val: '1.24 ETH', icon: Activity, color: 'text-amber-400' },
                        { label: 'Integrity Confidence', val: '99.98%', icon: ShieldAlert, color: 'text-blue-400' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <stat.icon className="h-12 w-12" />
                            </div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{stat.label}</p>
                            <p className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.val}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800 rounded-lg flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <Radio className="h-4 w-4 text-cyan-500" /> Orbital Feed Status
                            </h2>
                            <span className="text-[10px] font-mono text-slate-500">REAL-TIME</span>
                        </div>
                        <div className="p-4 space-y-3">
                            {orbitalFeeds.map((feed) => (
                                <div key={feed.id} className="p-3 bg-slate-950 border border-slate-800/50 rounded flex items-center justify-between group hover:border-cyan-500/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2 w-2 rounded-full ${feed.status === 'Anomaly Detected' ? 'bg-red-500 animate-pulse' : feed.status === 'Verifying' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                        <div>
                                            <p className="text-xs font-bold">{feed.name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{feed.type} • {feed.latency}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-[10px] font-bold uppercase ${feed.status === 'Anomaly Detected' ? 'text-red-400' : feed.status === 'Verifying' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {feed.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg flex flex-col h-[400px]">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-emerald-500" /> Reality Oracle Verification Logs
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-mono text-emerald-500">LISTENING</span>
                            </div>
                        </div>
                        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                            {verificationLogs.map((log, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                    <span className={log.status === 'success' ? 'text-emerald-400' : log.status === 'warning' ? 'text-red-400' : 'text-cyan-400'}>
                                        <span className="text-slate-500 mr-2 opacity-50 group-hover:opacity-100 transition-opacity">»</span>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                            <div className="flex gap-4 animate-pulse">
                                <span className="text-slate-600">[{mounted ? currentTime.toLocaleTimeString([], { hour12: false }) : ''}]</span>
                                <span className="text-emerald-400">
                                    <span className="text-slate-500 mr-2">»</span>
                                    Awaiting next block confirmation...
                                    <span className="ml-1 inline-block w-2 h-4 bg-emerald-500/50 align-middle" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <Layers className="h-4 w-4 text-amber-500" /> Smart Contract Trigger Matrix
                            </h2>
                            <div className="flex items-center gap-4 text-[10px] font-mono">
                                <span className="text-slate-500">FEE ACCRUAL: <span className="text-amber-400">0.1% Architecture</span></span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-900/80">
                                        <th className="p-4 text-[10px] font-bold uppercase text-slate-500">Contract ID</th>
                                        <th className="p-4 text-[10px] font-bold uppercase text-slate-500">Target Coordinates</th>
                                        <th className="p-4 text-[10px] font-bold uppercase text-slate-500">Value</th>
                                        <th className="p-4 text-[10px] font-bold uppercase text-slate-500">Status</th>
                                        <th className="p-4 text-[10px] font-bold uppercase text-slate-500 text-right">Fee (0.1%)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-mono">
                                    {triggerMatrix.map((item, i) => (
                                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 text-cyan-400">{item.id}</td>
                                            <td className="p-4 text-slate-300">{item.target}</td>
                                            <td className="p-4 font-bold text-white">{item.value}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${item.status === 'Settled' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : item.status === 'Disputed' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-slate-400">{item.fee}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div className="flex-1 bg-red-950/20 border border-red-900/50 rounded-lg p-4 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-red-400 flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 animate-pulse" /> Anomalies & Deepfake Alerts
                                </h2>
                                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">HIGH ALERT</span>
                            </div>
                            <div className="space-y-3">
                                {anomalies.map((anomaly, i) => (
                                    <div key={i} className="p-3 bg-red-900/20 border border-red-800/30 rounded group hover:bg-red-900/30 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-red-400 uppercase">{anomaly.level} • {anomaly.source}</span>
                                            <span className="text-[9px] text-red-500/70 font-mono">{anomaly.location}</span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-red-100/80 italic">"{anomaly.detail}"</p>
                                        <div className="mt-2 flex justify-end">
                                            <button className="text-[10px] flex items-center gap-1 text-red-400 font-bold hover:underline">
                                                INITIATE AUDIT <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                                    <Eye className="h-5 w-5 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase">Manual Coordinate Lookup</p>
                                    <p className="text-[10px] text-slate-500">Query reality oracle for specific GCS</p>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                                <input
                                    type="text"
                                    placeholder="Enter Lat/Long or AIS Hex ID..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded py-2 pl-10 pr-4 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 px-6 py-2 flex items-center justify-between text-[9px] font-mono text-slate-600">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-1"><Database className="h-3 w-3" /> DB: LOCAL_POSTGRES_VERIFIED</span>
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> GEO_CORE: ONLINE</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>BANDWIDTH: 1.2 GBPS</span>
                    <span className="text-cyan-500/50">SECURE TERMINAL ACTIVE</span>
                </div>
            </footer>
        </div>
    )
}
