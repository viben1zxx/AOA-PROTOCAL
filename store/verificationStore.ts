'use client'

import { create } from 'zustand'
import { VerificationResult, RealityTrigger, ProofReport } from '@/types/verification'
import { apiClient } from '@/lib/apiClient'

interface VerificationStore {
    // State
    verifications: VerificationResult[]
    recentTriggers: RealityTrigger[]
    loading: boolean
    error: string | null

    // Actions
    fetchVerifications: () => Promise<void>
    initiateVerification: (lat: number, lon: number) => Promise<VerificationResult>
    generateProofReport: (result: VerificationResult) => Promise<ProofReport>
    addVerification: (verification: VerificationResult) => void
    clearError: () => void
}

export const useVerificationStore = create<VerificationStore>((set, get) => ({
    // Initial state
    verifications: [],
    recentTriggers: [],
    loading: false,
    error: null,

    // Fetch all verifications
    fetchVerifications: async () => {
        set({ loading: true, error: null })
        try {
            const verifications = await apiClient.getVerifications()
            const recentTriggers = await apiClient.getRecentTriggers()
            set({ verifications, recentTriggers, loading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch verifications'
            set({ error: message, loading: false })
        }
    },

    // Initiate new verification
    initiateVerification: async (lat: number, lon: number) => {
        set({ loading: true, error: null })
        try {
            const result = await apiClient.initiateVerification(lat, lon)
            get().addVerification(result)
            set({ loading: false })
            return result
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Verification failed'
            set({ error: message, loading: false })
            throw error
        }
    },

    // Generate proof report
    generateProofReport: async (result: VerificationResult) => {
        try {
            const report = await apiClient.generateProofReport(result)
            return report
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Report generation failed'
            set({ error: message })
            throw error
        }
    },

    // Add verification to list
    addVerification: (verification: VerificationResult) => {
        set(state => ({
            verifications: [verification, ...state.verifications]
        }))
    },

    // Clear error
    clearError: () => set({ error: null })
}))
