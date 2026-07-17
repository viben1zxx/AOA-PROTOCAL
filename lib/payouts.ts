import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2022-11-15',
})

const ARCHITECT_WALLET_ID = process.env.STRIPE_ARCHITECT_WALLET_ID!
const ARCHITECT_BANK_ACCOUNT_ID = process.env.STRIPE_BANK_ACCOUNT_ID!

function isPlaceholderValue(value?: string): boolean {
    return (
        !value ||
        value === 'sk_test_...' ||
        value === 'acct_...' ||
        value === 'ba_...'
    )
}

function ensureStripeClient(): Stripe {
    return stripe
}

function ensureStripeConfig(): void {
    const missing: string[] = []

    if (isPlaceholderValue(process.env.STRIPE_SECRET_KEY)) missing.push('STRIPE_SECRET_KEY')
    if (isPlaceholderValue(process.env.STRIPE_ARCHITECT_WALLET_ID)) missing.push('STRIPE_ARCHITECT_WALLET_ID')
    if (isPlaceholderValue(process.env.STRIPE_BANK_ACCOUNT_ID)) missing.push('STRIPE_BANK_ACCOUNT_ID')

    if (missing.length > 0) {
        throw new Error(`Missing Stripe config: ${missing.join(', ')}`)
    }
}

export async function getArchitectWalletBalance(): Promise<number> {
    ensureStripeConfig()
    const balance = await ensureStripeClient().balance.retrieve({ stripeAccount: ARCHITECT_WALLET_ID })
    const usdBalance = balance.available?.find((item) => item.currency === 'usd')
    return usdBalance?.amount ? usdBalance.amount / 100 : 0
}

export async function triggerPayoutToBank(amountUsd: number): Promise<Stripe.Payout> {
    ensureStripeConfig()

    const amountCents = Math.round(amountUsd * 100)
    return ensureStripeClient().payouts.create({
        amount: amountCents,
        currency: 'usd',
        destination: ARCHITECT_BANK_ACCOUNT_ID,
        method: 'standard',
        statement_descriptor: 'AOA Protocol Fee',
    })
}

export async function payoutIfThresholdReached(thresholdUsd = 500): Promise<{ paid: boolean; amountUsd: number; payoutId?: string }> {
    ensureStripeConfig()

    const currentBalance = await getArchitectWalletBalance()
    if (currentBalance < thresholdUsd) {
        return { paid: false, amountUsd: currentBalance }
    }

    const payout = await triggerPayoutToBank(thresholdUsd)
    return { paid: true, amountUsd: thresholdUsd, payoutId: payout.id }
}

export async function getWalletBalanceDetails(): Promise<Stripe.Balance> {
    ensureStripeConfig()
    return ensureStripeClient().balance.retrieve({ stripeAccount: ARCHITECT_WALLET_ID })
}
