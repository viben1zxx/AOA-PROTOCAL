'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: '#1e293b',
                        color: '#f1f5f9',
                        border: '1px solid #475569',
                    },
                }}
            />
        </QueryClientProvider>
    )
}
