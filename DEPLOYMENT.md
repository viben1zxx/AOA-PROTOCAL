# AOA Protocol - Deployment Guide

## Production Deployment Checklist

### Phase 1: Smart Contract Audit & Deployment (Week 1-2)

#### Step 1: Security Audit
- [ ] Engage professional auditor (OpenZeppelin, Trail of Bits, Consensys)
- [ ] Fix critical/high vulnerabilities
- [ ] Implement suggested optimizations
- [ ] Obtain audit certificate

#### Step 2: Testnet Deployment
```bash
# Deploy to Sepolia testnet first
npx hardhat run scripts/deploy.js --network sepolia

# Example output:
# AOAEscrowVault deployed to: 0x1234567890...
# Save this address to .env
```

#### Step 3: Mainnet Deployment
```bash
# Deploy to Ethereum mainnet
npx hardhat run scripts/deploy.js --network mainnet

# Check deployment
npx etherscan-verify --network mainnet \
  --license MIT \
  --solc-version 0.8.20
```

#### Step 4: Initialize Contract
```solidity
// Call after deployment
contract.setArchitectWallet(0xArchitectAddress)
contract.setRealityOracle(0xOracleSignerAddress)
contract.setRegionalModerator("US", 0xUSModeratorAddress)
contract.setRegionalModerator("China", 0xChinaModeratorAddress)
contract.setRegionalModerator("GlobalSouth", 0xGlobalSouthModeratorAddress)
```

---

### Phase 2: Backend Infrastructure (Week 2-3)

#### Step 1: Satellite API Setup
```bash
# Register with Copernicus Hub
curl -X POST https://dataspace.copernicus.eu/api/token \
  -d "client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&grant_type=client_credentials"

# Register with Sentinel Hub
# Get credentials from https://services.sentinel-hub.com/oauth/auth
echo "SENTINEL_HUB_TOKEN=$TOKEN" >> .env
```

#### Step 2: LLM Setup
```bash
# Create OpenAI account and get API key
export OPENAI_API_KEY=sk_...

# Test LangChain agent
python -c "
from reality_fusion_engine import AutonomousScoutingAgent, Config
config = Config()
agent = AutonomousScoutingAgent(config)
agent.initialize_agent()
print('Agent initialized successfully')
"
```

#### Step 3: Web3 Configuration
```bash
# Fund the oracle signer wallet
# Minimum: 5 ETH for gas fees over 1 year

# Test contract interaction
python -c "
from reality_fusion_engine import RealityTriggerManager, Config
config = Config()
manager = RealityTriggerManager(config)
print(f'Connected to {config.WEB3_PROVIDER}')
print(f'Account: {manager.account.address}')
print(f'Balance: {manager.w3.eth.get_balance(manager.account.address)} wei')
"
```

#### Step 4: Deploy Backend Service
```bash
# Using AWS/DigitalOcean/GCP

# Option A: Docker Container
docker build -t aoa-reality-fusion-engine .
docker run -d \
  -e COPERNICUS_USERNAME=$USER \
  -e COPERNICUS_PASSWORD=$PASS \
  -e PRIVATE_KEY=$PRIVATE_KEY \
  aoa-reality-fusion-engine

# Option B: Kubernetes (Recommended for scale)
kubectl create namespace aoa-protocol
kubectl apply -f k8s/deployment.yaml -n aoa-protocol
kubectl logs -f deployment/reality-fusion-engine -n aoa-protocol
```

#### Step 5: Database Setup
```bash
# PostgreSQL
createdb aoa_protocol
psql aoa_protocol < schema.sql

# Redis for caching
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

### Phase 3: Frontend Deployment (Week 3-4)

#### Step 1: Build Optimization
```bash
# Analyze bundle
npm run build
npm run analyze

# Expected: <100KB for main bundle with Mapbox
```

#### Step 2: Deploy to Vercel
```bash
# Login to Vercel
npm i -g vercel
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN
vercel env add NEXT_PUBLIC_API_URL
```

#### Step 3: Deploy to AWS Amplify (Alternative)
```bash
# Connect to GitHub repo
amplify init
amplify add hosting
amplify publish

# Custom domain
amplify update hosting
```

#### Step 4: CDN Configuration
```bash
# Cloudflare setup for dashboard.aoa-protocol.io
# Add DNS records:
# dashboard.aoa-protocol.io -> CNAME vercel deployment
# Enable:
# - Security: WAF, DDoS protection
# - Performance: Cache everything
# - Analytics: Enable
```

---

### Phase 4: Institutional API Integration (Week 4)

#### Step 1: Kalshi Integration
```python
# Contact Kalshi API team
# Whitelist AOA oracle address: 0xOracleAddress

# Test integration
from aoa_integrations.kalshi import KalshiVerificationAdapter

adapter = KalshiVerificationAdapter(
    api_key=KALSHI_API_KEY,
    contract_address=CONTRACT_ADDRESS
)

# Monitor for physical settlement markets
markets = adapter.monitor_physical_settlement_markets()
print(f"Found {len(markets)} markets requiring physical verification")
```

#### Step 2: Polymarket Integration
```python
from aoa_integrations.polymarket import PolymarketVerificationAdapter

adapter = PolymarketVerificationAdapter(
    rpc_url=WEB3_PROVIDER,
    contract_address=CONTRACT_ADDRESS
)

# Auto-settle markets
adapter.auto_settle_physical_markets()
```

#### Step 3: Insurance Company Onboarding
```bash
# Create dedicated API key for each insurance partner
python -c "
from smart_contract import create_api_key
import hashlib

insurance_co = '0xInsuranceCompanyAddress'
api_key = create_api_key(
    institution=insurance_co,
    region='US',
    queries_allowed=5000,  # 5000 queries/year
    monthly_fee=5000  # $5000/month
)
print(f'API Key created: {api_key}')
"
```

---

### Phase 5: Monitoring & Scaling (Ongoing)

#### Step 1: Infrastructure Monitoring
```yaml
# Prometheus + Grafana setup
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

#### Step 2: Alert Configuration
```bash
# Set alerts for:
# - Satellite API downtime
# - Query failure rate > 5%
# - Smart contract settlement delays > 1 hour
# - Database query latency > 2 seconds
# - API error rate > 1%
```

#### Step 3: Performance Optimization
```python
# Cache verification results
from redis import Redis

redis_client = Redis(host='localhost', port=6379)

# Cache for 24 hours
def get_or_verify(latitude, longitude):
    cache_key = f"verification:{latitude}:{longitude}"
    cached = redis_client.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    # Run verification if not cached
    result = cross_verify(latitude, longitude)
    redis_client.setex(cache_key, 86400, json.dumps(result))
    return result
```

#### Step 4: Auto-scaling
```bash
# Kubernetes auto-scaling
kubectl autoscale deployment reality-fusion-engine \
  --min=3 --max=10 \
  --cpu-percent=70 \
  -n aoa-protocol
```

---

### Phase 6: Regional Deployment (Week 6-8)

#### Deployment by Region

**US Region (Legal/Compliance Focus)**
```bash
# Deploy in us-east-1 (N. Virginia)
# Ensure GDPR/CCPA compliance
# Set regional moderator for US

# Cost: ~$500/month infrastructure
```

**China Region (Supply Chain Focus)**
```bash
# Deploy in ap-beijing (Alibaba Cloud)
# Comply with data localization laws
# Partner with local provider (Alibaba/Tencent)

# Cost: ~$800/month infrastructure
```

**Global South Region (Trustless Trade Focus)**
```bash
# Deploy globally on edge network (Cloudflare Workers)
# Minimize latency for decentralized users
# No data residency requirements

# Cost: ~$300/month infrastructure
```

---

## Troubleshooting

### Common Issues

#### Issue: Satellite API Rate Limit
```python
# Solution: Implement request queuing
from queue import Queue
from threading import Thread

request_queue = Queue()

def api_worker():
    while True:
        request = request_queue.get()
        try:
            result = satellite_api.fetch_data(request)
            request.callback(result)
        except RateLimitError:
            request_queue.put(request)  # Retry after delay
```

#### Issue: Smart Contract Gas Costs Too High
```solidity
// Solution: Batch operations
function batchRecordAPIUsage(
    bytes32[] calldata _apiKeyHashes,
    uint256[] calldata _queryFees
) external onlyOracleOrOwner {
    for (uint i = 0; i < _apiKeyHashes.length; i++) {
        recordAPIKeyUsage(_apiKeyHashes[i], _queryFees[i]);
    }
}
```

#### Issue: Frontend Mapbox Token Disabled
```bash
# Solution: Rotate token quarterly
# Generate new token at https://account.mapbox.com/tokens/
# Update NEXT_PUBLIC_MAPBOX_TOKEN env var
# Redeploy frontend
vercel env rm NEXT_PUBLIC_MAPBOX_TOKEN
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN
vercel --prod
```

---

## Cost Estimates (Monthly)

| Component | Environment | Cost |
|-----------|-------------|------|
| Smart Contract (Gas) | Mainnet | $200 |
| Backend Compute | Production | $500 |
| Database | PostgreSQL (managed) | $100 |
| Satellite APIs | Copernicus Hub | $0 (free) |
| LLM (GPT-4) | 1000 queries/month | $30 |
| Frontend Hosting | Vercel | $20 |
| CDN | Cloudflare | $20 |
| Monitoring | DataDog | $50 |
| **Total** | | **~$920/month** |

---

## Success Metrics

After deployment, track:

1. **Verification Accuracy**: >95% confidence score average
2. **Settlement Speed**: <30 minutes from Reality Trigger to escrow release
3. **Institutional Adoption**: 3+ institutional partners within 6 months
4. **Query Volume**: 100+ queries/month by month 3
5. **Revenue**: $50K+ monthly by month 6

---

## Rollback Procedures

### Emergency Contract Pause
```solidity
// If critical bug discovered
contract.pause()  // Stop all settlements

// Fix in new contract
// Users recover funds via:
contract.withdraw()
```

### Backend Rollback
```bash
# Kubernetes rollback
kubectl rollout undo deployment/reality-fusion-engine -n aoa-protocol

# Roll back frontend
vercel rollback
```

---

## Post-Deployment

- [ ] Monitor errors and metrics 24/7
- [ ] Weekly security reviews
- [ ] Monthly upgrades to models
- [ ] Quarterly contract audits
- [ ] Annual compliance reviews

---

**AOA Protocol is production-ready when you receive the green light from security audit and have signed institutional partners ready to launch.**
