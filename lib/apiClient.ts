/**
 * API Client for AOA Protocol Backend
 */

import { ContainmentAction, ContainmentResponse, VerificationResult, RealityTrigger, ProofReport } from '@/types/verification'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

class APIClient {
    private baseUrl: string

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            ...options,
        })

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    // Fetch all verifications
    async getVerifications(): Promise<VerificationResult[]> {
        return this.request<VerificationResult[]>('/verifications')
    }

    // Fetch recent reality triggers
    async getRecentTriggers(): Promise<RealityTrigger[]> {
        return this.request<RealityTrigger[]>('/triggers/recent')
    }

    // Initiate satellite verification
    async initiateVerification(latitude: number, longitude: number): Promise<VerificationResult> {
        return this.request<VerificationResult>('/verifications/initiate', {
            method: 'POST',
            body: JSON.stringify({
                latitude,
                longitude,
                start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date().toISOString(),
            }),
        })
    }

    // Generate proof report
    async generateProofReport(verification: VerificationResult): Promise<ProofReport> {
        return this.request<ProofReport>('/reports/generate', {
            method: 'POST',
            body: JSON.stringify(verification),
        })
    }

    private async createSignedPayload(action: ContainmentAction): Promise<string> {
        const normalizedPayload = JSON.stringify({
            verification_hash: action.verification_hash,
            action: action.action,
            requested_by: action.requested_by,
            approval_signatures: action.approval_signatures,
            timestamp: action.timestamp,
            context: action.context ?? null,
        })

        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedPayload))
        const bytes = new Uint8Array(hashBuffer)
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
    }

    async submitContainmentAction(action: ContainmentAction): Promise<ContainmentResponse> {
        const signedPayload = await this.createSignedPayload(action)
        return this.request<ContainmentResponse>('/containment', {
            method: 'POST',
            body: JSON.stringify({ ...action, signed_payload: signedPayload }),
        })
    }

    // Submit API key usage
    async recordAPIKeyUsage(apiKeyHash: string, queryFee: number): Promise<void> {
        return this.request<void>('/api-keys/usage', {
            method: 'POST',
            body: JSON.stringify({ api_key_hash: apiKeyHash, query_fee: queryFee }),
        })
    }

    // Get market data from Kalshi
    async getKalshiMarkets(searchQuery: string): Promise<any[]> {
        return this.request<any[]>(`/markets/kalshi?search=${encodeURIComponent(searchQuery)}`)
    }

    // Get market data from Polymarket
    async getPolymarketMarkets(searchQuery: string): Promise<any[]> {
        return this.request<any[]>(`/markets/polymarket?search=${encodeURIComponent(searchQuery)}`)
    }
}

export const apiClient = new APIClient()
