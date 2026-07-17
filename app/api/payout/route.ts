import { NextResponse } from 'next/server'
import { payoutIfThresholdReached, getArchitectWalletBalance } from '@/lib/payouts'

const REQUIRED_ENV = [
    'STRIPE_SECRET_KEY',
    'STRIPE_ARCHITECT_WALLET_ID',
    'STRIPE_BANK_ACCOUNT_ID',
]

const PLACEHOLDER_VALUES = new Set(['sk_test_...', 'acct_...', 'ba_...'])

function isInvalidEnv(value?: string): boolean {
    return !value || PLACEHOLDER_VALUES.has(value)
}

function getMissingEnv(): string[] {
    return REQUIRED_ENV.filter((key) => isInvalidEnv(process.env[key]))
}

export async function POST() {
    const missingEnv = getMissingEnv()
    if (missingEnv.length > 0) {
        return NextResponse.json(
            {
                error: `Missing environment variables: ${missingEnv.join(', ')}`,
            },
            { status: 400 }
        )
    }

    try {
        const payout = await payoutIfThresholdReached(500)
        if (!payout.paid) {
            const balance = await getArchitectWalletBalance().catch(() => 0)
            return NextResponse.json(
                {
                    error: `Balance too low for payout. Current available balance: $${balance.toFixed(2)}. Minimum required: $500.00.`,
                    balance,
                },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            amountUsd: payout.amountUsd,
            payoutId: payout.payoutId,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown payout error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
