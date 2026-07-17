/**
 * AOA Protocol Type Definitions
 */

export interface VerificationResult {
    location: [number, number]           // [latitude, longitude]
    timestamp: string
    is_physical: boolean                 // True if asset is physically present
    confidence_score: number             // 0-100%
    anomaly_type: string | null          // "SYNTHETIC", "MISSING_MASS", "DUPLICATE", null
    sar_intensity: number                // SAR backscatter intensity
    optical_brightness: number           // Optical reflectivity (0-1)
    correlation: number                  // SAR-Optical correlation (0-1)
    verification_hash: string            // Cryptographic hash of verification
}

export interface RealityTrigger {
    verification_hash: string
    location: string                     // "lat,lon" format
    signature: string                    // Cryptographic signature (0x...)
    market_id: string                    // Kalshi/Polymarket ID
    timestamp: string
    is_physical: boolean
}

export interface ProofReport {
    report_id: string
    verification_hash: string
    is_physical: boolean
    confidence_score: number
    location: [number, number]
    timestamp: string
    sar_data: {
        intensity: number
        polarization: string[]
    }
    optical_data: {
        brightness: number
        ndvi: number
        cloud_cover: number
    }
    correlation: number
    anomaly_type: string | null
    cryptographic_signature: string
    ipfs_hash: string                    // IPFS storage reference
    legal_certification: {
        timestamp: string
        issuer: string
        certification_level: 'high' | 'medium' | 'low'
    }
}

export interface APIKeyRecord {
    api_key_hash: string
    institution: string
    queries_allowed: number
    queries_used: number
    total_fee_paid: number
    active: boolean
    region: 'US' | 'China' | 'GlobalSouth'
}

export type ContainmentActionType = 'isolate-host' | 'revoke-token' | 'rotate-api-keys'

export interface ContainmentAction {
    verification_hash: string
    action: ContainmentActionType
    requested_by: string
    approval_signatures: string[]
    timestamp: string
    signed_payload?: string
    context?: string
}

export interface ContainmentResponse {
    accepted: boolean
    audit_id: string
    status: 'queued' | 'executed' | 'pending'
    message: string
}

export interface AgentStreamEvent {
    agent: 'Supervisor' | 'Identity' | 'Network'
    phase: string
    message: string
    tool_step: string
    timestamp: string
    severity: 'info' | 'warning' | 'critical'
}

export interface ThreatNode {
    id: string
    label: string
    type: 'attacker' | 'ip' | 'user' | 'host' | 'file' | 'database'
    risk: 'critical' | 'high' | 'medium' | 'low'
}

export interface ThreatEdge {
    id: string
    source: string
    target: string
    relation: string
}
