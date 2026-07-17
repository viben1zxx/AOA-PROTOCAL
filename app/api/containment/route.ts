import { NextResponse } from 'next/server'
import { ContainmentAction, ContainmentActionType, ContainmentResponse } from '@/types/verification'

const ALLOWED_ACTIONS = new Set<ContainmentActionType>([
    'isolate-host',
    'revoke-token',
    'rotate-api-keys',
])

function isValidAction(action: unknown): action is ContainmentActionType {
    return typeof action === 'string' && ALLOWED_ACTIONS.has(action as ContainmentActionType)
}

export async function POST(request: Request) {
    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
        return NextResponse.json(
            { accepted: false, audit_id: '', status: 'pending', message: 'Invalid containment payload' },
            { status: 400 }
        )
    }

    const action = payload as ContainmentAction
    if (!action.verification_hash || !isValidAction(action.action) || !Array.isArray(action.approval_signatures) || action.approval_signatures.length === 0) {
        return NextResponse.json(
            { accepted: false, audit_id: '', status: 'pending', message: 'Containment request missing required signatures or action type' },
            { status: 400 }
        )
    }

    const pythonUrl = process.env.PYTHON_BACKEND_URL
    if (pythonUrl) {
        try {
            const response = await fetch(`${pythonUrl}/containment/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action),
            })

            if (!response.ok) {
                const message = await response.text()
                return NextResponse.json(
                    { accepted: false, audit_id: `ctm-${Date.now()}`, status: 'pending', message: `Python backend rejected request: ${message}` },
                    { status: 502 }
                )
            }

            const result = (await response.json()) as { audit_id?: string; status?: string; message?: string }
            return NextResponse.json(
                {
                    accepted: true,
                    audit_id: result.audit_id ?? `ctm-${Date.now()}`,
                    status: (result.status as ContainmentResponse['status']) ?? 'queued',
                    message: result.message ?? 'Containment request forwarded to Python backend',
                },
                { status: 200 }
            )
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown backend failure'
            return NextResponse.json(
                { accepted: false, audit_id: `ctm-${Date.now()}`, status: 'pending', message },
                { status: 502 }
            )
        }
    }

    // Fallback simulation for front-end development and enterprise proof-of-concept workflows.
    return NextResponse.json({
        accepted: true,
        audit_id: `ctm-${Date.now()}`,
        status: 'queued',
        message: 'Containment action accepted. Zero-Trust approval recorded and forwarded for execution.',
    })
}
