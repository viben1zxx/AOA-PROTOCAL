'use client'

import React from 'react'
import Link from 'next/link'
import { Satellite } from 'lucide-react'

export function Navbar() {
    return (
        <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Satellite className="w-6 h-6 text-cyan-400" />
                    <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        AOA Protocol
                    </span>
                </Link>

                <div className="flex items-center gap-6">
                    <Link
                        href="/dashboard"
                        className="text-slate-300 hover:text-cyan-400 transition-colors font-medium"
                    >
                        Dashboard
                    </Link>

                    <Link
                        href="/docs"
                        className="text-slate-300 hover:text-cyan-400 transition-colors font-medium"
                    >
                        Documentation
                    </Link>

                    <a
                        href="https://github.com/aoa-protocol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-300 hover:text-cyan-400 transition-colors font-medium"
                    >
                        GitHub
                    </a>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-slate-400">Live</span>
                    </div>
                </div>
            </div>
        </nav>
    )
}
