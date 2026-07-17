import { AgentStreamEvent } from '@/types/verification'

const DEFAULT_AGENT_EVENTS: AgentStreamEvent[] = [
    {
        agent: 'Supervisor',
        phase: 'initialize',
        message: 'Supervisor agent booting and establishing trusted agent topology.',
        tool_step: 'Supervisor orchestration check',
        timestamp: new Date().toISOString(),
        severity: 'info',
    },
    {
        agent: 'Identity',
        phase: 'auth-analysis',
        message: 'Identity agent is validating session certificates and behavior anomalies.',
        tool_step: 'Identity access pattern scoring',
        timestamp: new Date().toISOString(),
        severity: 'info',
    },
    {
        agent: 'Network',
        phase: 'telemetry',
        message: 'Network agent is ingesting packet metadata and tracing suspicious lateral movement.',
        tool_step: 'Telemetry correlation engine',
        timestamp: new Date().toISOString(),
        severity: 'info',
    },
    {
        agent: 'Supervisor',
        phase: 'aggregate',
        message: 'Supervisor agent is combining identity and network evidence for a consolidated threat score.',
        tool_step: 'Evidence aggregation',
        timestamp: new Date().toISOString(),
        severity: 'warning',
    },
    {
        agent: 'Network',
        phase: 'countermeasure',
        message: 'Network agent detected suspicious host pivot and is preparing containment recommendations.',
        tool_step: 'Host isolation evaluator',
        timestamp: new Date().toISOString(),
        severity: 'critical',
    },
]

const WAIT_MS = 700

function encodeSSE(event: AgentStreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function GET(request: Request) {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId') ?? 'default-session'

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            const events = DEFAULT_AGENT_EVENTS.map((event, index) => ({
                ...event,
                timestamp: new Date(Date.now() + index * 250).toISOString(),
                message: event.message.replace('trusted', sessionId),
            }))

            for (const event of events) {
                controller.enqueue(encoder.encode(encodeSSE(event)))
                await sleep(WAIT_MS)
            }

            controller.enqueue(encoder.encode(encodeSSE({
                agent: 'Supervisor',
                phase: 'healthy',
                message: 'Agent network is live and ready for real-time SOC operations.',
                tool_step: 'Supervisor heartbeat',
                timestamp: new Date().toISOString(),
                severity: 'info',
            })))
            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    })
}
