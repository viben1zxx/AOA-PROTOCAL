# AOA Protocol - API Key Management System

## Overview

The AOA Protocol uses an **institutional API key system** for managing access to the satellite verification service. API keys are managed on-chain via the smart contract, enabling:

- Transparent fee tracking
- Per-query billing in USDC
- Regional access control
- Usage quotas and rate limiting
- Institutional accountability

---

## API Key Lifecycle

### 1. **Creation** (Owner/Admin Only)

```solidity
function createAPIKey(
    address _institution,
    bytes32 _apiKeyHash,
    uint256 _queriesAllowed,
    string memory _region
) external onlyOwner
```

**Parameters:**
- `_institution`: Address of the institution (e.g., Kalshi, Polymarket, Insurance Co.)
- `_apiKeyHash`: SHA-256 hash of the actual API key (secret key never stored)
- `_queriesAllowed`: Number of queries allocated (e.g., 10,000)
- `_region`: Deployment region ("US", "China", "GlobalSouth")

**Example (Backend):**
```python
# Generate API key
api_key = secrets.token_urlsafe(32)
api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

# Create on-chain
contract.functions.createAPIKey(
    institution_address="0x...",
    api_key_hash=f"0x{api_key_hash}",
    queries_allowed=10000,
    region="US"
).transact()

# Store secret key securely in vault (Hashicorp Vault, AWS Secrets Manager, etc.)
vault.store_secret(f"aoa_api_key_{api_key_hash[:16]}", api_key)
```

### 2. **Usage Tracking** (Automatic on Each Query)

```solidity
function recordAPIKeyUsage(
    bytes32 _apiKeyHash,
    uint256 _queryFeeInUSDC
) external onlyOracleOrOwner onlyValidAPIKey(_apiKeyHash)
```

**Flow:**
1. Institutional client requests verification at a location
2. Backend validates API key against registry
3. Satellite scan performed (SAR + Optical)
4. Cross-verification completed
5. Backend calls `recordAPIKeyUsage()` with:
   - `_apiKeyHash`: The key that was used
   - `_queryFeeInUSDC`: Fee charged (e.g., 50 USDC for US region)

**Example (Backend):**
```python
# After verification complete
from web3 import Web3

w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

# Transfer USDC from institution to architect wallet
# Then record usage on-chain
tx = contract.functions.recordAPIKeyUsage(
    api_key_hash=web3_api_key_hash,
    query_fee_in_usdc=50
).transact()

print(f"Usage recorded: {tx}")
```

### 3. **Fee Collection**

```solidity
mapping(bytes32 => APIKeyRecord) public apiKeyRegistry;

struct APIKeyRecord {
    address institution;
    bytes32 apiKeyHash;
    uint256 queriesAllowed;
    uint256 queriesUsed;
    uint256 totalFeePaid;
    bool active;
    string region;
}
```

**Automatic Fee Routing:**
- Institution transfers USDC to smart contract
- Smart contract routes 100% of query fees to `architect_wallet`
- Settlement amounts route 0.1% to `architect_wallet` (separate from query fees)

---

## Regional Pricing Model

### US Region (Legal/Insurance/Commodity Swaps)
- **Per-Query Fee**: $50 - $100
- **Monthly Minimum**: $5,000
- **Use Cases**: Insurance claims, commodity swaps, prediction markets
- **Compliance**: CFTC, SEC, state insurance regulators

### China Region (Industrial/Supply Chain)
- **Per-Query Fee**: $30 - $75 (CNY equivalent)
- **Monthly Minimum**: $3,000
- **Use Cases**: Port monitoring, factory verification, supply chain
- **Compliance**: MIIT, SAMR, regional trade authorities

### Global South Region (P2P/Trustless Trade)
- **Per-Query Fee**: $10 - $25
- **Monthly Minimum**: $1,000
- **Use Cases**: Peer-to-peer commodity trading, decentralized settlement
- **Compliance**: Local fintech regulations

---

## Query Fee Calculation

```python
def calculate_query_fee(region: str, asset_type: str, verification_type: str) -> float:
    """
    Calculate dynamic query fee based on multiple factors
    """
    base_fees = {
        "US": 50.0,
        "China": 30.0,
        "GlobalSouth": 10.0
    }
    
    asset_multipliers = {
        "oil_tanker": 2.0,      # Complex multi-sensor verification
        "factory": 1.5,          # Industrial complex
        "port": 1.8,             # High-value asset
        "farm": 1.0,             # Simple verification
        "container_ship": 2.2,   # Highly valuable
    }
    
    verification_multipliers = {
        "presence_only": 1.0,
        "operational_status": 1.3,
        "occupancy_count": 1.5,
        "detailed_analysis": 1.8,
    }
    
    base = base_fees.get(region, 50.0)
    asset_mult = asset_multipliers.get(asset_type, 1.0)
    verification_mult = verification_multipliers.get(verification_type, 1.0)
    
    return base * asset_mult * verification_mult
```

---

## API Key Quotas and Rate Limiting

### Query Quotas

```solidity
// Check remaining queries
function getRemainingQueries(bytes32 _apiKeyHash) 
    external 
    view 
    returns (uint256) 
{
    APIKeyRecord memory record = apiKeyRegistry[_apiKeyHash];
    return record.queriesAllowed - record.queriesUsed;
}

// Refund queries (admin only)
function refundQueries(bytes32 _apiKeyHash, uint256 _refundAmount)
    external
    onlyOwner
{
    apiKeyRegistry[_apiKeyHash].queriesUsed -= _refundAmount;
}
```

### Rate Limiting (Backend)

```python
from datetime import datetime, timedelta
from typing import Dict

class RateLimiter:
    def __init__(self, queries_per_minute: int = 10):
        self.queries_per_minute = queries_per_minute
        self.query_timestamps: Dict[str, list] = {}
    
    def is_rate_limited(self, api_key_hash: str) -> bool:
        """Check if API key has exceeded rate limit"""
        now = datetime.now()
        one_minute_ago = now - timedelta(minutes=1)
        
        if api_key_hash not in self.query_timestamps:
            self.query_timestamps[api_key_hash] = []
        
        # Remove old timestamps
        self.query_timestamps[api_key_hash] = [
            ts for ts in self.query_timestamps[api_key_hash]
            if ts > one_minute_ago
        ]
        
        # Check limit
        if len(self.query_timestamps[api_key_hash]) >= self.queries_per_minute:
            return True
        
        # Record this query
        self.query_timestamps[api_key_hash].append(now)
        return False

# Usage in backend
rate_limiter = RateLimiter(queries_per_minute=10)

@app.post("/api/verifications/initiate")
async def initiate_verification(
    latitude: float,
    longitude: float,
    api_key: str = Header(...)
):
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    if rate_limiter.is_rate_limited(api_key_hash):
        return {"error": "Rate limit exceeded"}
    
    # Continue with verification...
```

---

## Institutional Integration Examples

### Example 1: Kalshi Integration

```python
# Kalshi wants to verify oil tanker position for prediction market settlement
# Market ID: "KALSHI_OIL_TANKER_Q2_2024"

kalshi_api_key = "kalshi_prod_key_abcd1234"
kalshi_api_key_hash = hashlib.sha256(kalshi_api_key.encode()).hexdigest()

# 1. Check if key is valid and has queries remaining
record = contract.functions.getAPIKeyStatus(kalshi_api_key_hash).call()

if not record['active'] or record['queriesUsed'] >= record['queriesAllowed']:
    raise Exception("API key invalid or quota exceeded")

# 2. Get market details from Kalshi
market = kalshi_client.get_market("KALSHI_OIL_TANKER_Q2_2024")
# market.location = (1.2558, 103.7618)  # Singapore port

# 3. Initiate satellite verification
verification = await initiate_verification(
    latitude=1.2558,
    longitude=103.7618
)

# 4. Generate Reality Trigger
trigger = trigger_manager.generate_reality_trigger(
    verification_result=verification,
    market_id="KALSHI_OIL_TANKER_Q2_2024"
)

# 5. Submit Reality Trigger to smart contract
tx_hash = trigger_manager.submit_to_contract(trigger)

# 6. Charge Kalshi for the query
fee = calculate_query_fee("US", "oil_tanker", "presence_only")  # $100

contract.functions.recordAPIKeyUsage(
    api_key_hash=kalshi_api_key_hash,
    query_fee_in_usdc=int(fee * 10**6)  # Convert to USDC wei
).transact()

# Market auto-settles based on Reality Trigger
# 0.1% of settlement goes to architect_wallet + $100 query fee
```

### Example 2: Insurance Company Integration

```python
# Insurance company verifying factory damage claim
# Claim ID: "INS_CLAIM_FACTORY_FIRE_2024"

insurance_api_key = "insurance_prod_key_xyz9876"
insurance_api_key_hash = hashlib.sha256(insurance_api_key.encode()).hexdigest()

# 1. Verify API key
record = contract.functions.getAPIKeyStatus(insurance_api_key_hash).call()
assert record['region'] == 'US'

# 2. Get claim location from claim data
claim = claims_db.get_claim("INS_CLAIM_FACTORY_FIRE_2024")
# claim.location = (40.7128, -74.0060)  # Manhattan factory

# 3. Fetch satellite imagery from 1 week ago (before fire)
verification_before = await initiate_verification(
    latitude=40.7128,
    longitude=-74.0060,
    start_date=datetime.now() - timedelta(days=7),
    end_date=datetime.now() - timedelta(days=1)
)

# 4. Fetch satellite imagery from today (after fire)
verification_after = await initiate_verification(
    latitude=40.7128,
    longitude=-74.0060,
    start_date=datetime.now() - timedelta(hours=24),
    end_date=datetime.now()
)

# 5. Compare to prove damage
print(f"Before fire - Confidence: {verification_before.confidence_score}%")
print(f"After fire - Anomaly: {verification_after.anomaly_type}")

# 6. Generate Proof-of-Reality report for claim settlement
before_report = generateProofReport(verification_before)
after_report = generateProofReport(verification_after)

# 7. Both reports now on-chain with signatures
# Insurance company can use for claim payout without additional verification

# Charge for both queries
fee_per_query = calculate_query_fee("US", "factory", "operational_status")
total_fee = fee_per_query * 2

contract.functions.recordAPIKeyUsage(
    api_key_hash=insurance_api_key_hash,
    query_fee_in_usdc=int(total_fee * 10**6)
).transact()
```

---

## Security Best Practices

### API Key Storage

**DO:**
- Store keys in environment variables or secrets manager (Hashicorp Vault, AWS Secrets Manager)
- Rotate keys monthly
- Hash keys before storing in database
- Use different keys for different environments (dev, staging, prod)

**DON'T:**
- Commit keys to version control
- Store keys in plaintext
- Share keys between institutions
- Use same key for multiple regions

### Query Verification

```python
def verify_query_authenticity(
    api_key: str,
    latitude: float,
    longitude: float,
    signature: str
) -> bool:
    """Verify query came from legitimate API key holder"""
    
    message = f"{latitude}:{longitude}:{timestamp}"
    expected_signature = hmac.new(
        api_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return signature == expected_signature
```

---

## Monitoring & Compliance

### Query Audit Log

```python
# Log all queries for compliance
audit_log = {
    "timestamp": datetime.now().isoformat(),
    "api_key_hash": api_key_hash[:16] + "...",  # Partially redacted
    "institution": "Kalshi",
    "region": "US",
    "location": (1.2558, 103.7618),
    "asset_type": "oil_tanker",
    "fee_charged": 100,
    "verification_hash": "0xabc123...",
    "settlement_status": "pending",
}

audit_db.insert(audit_log)
```

### Monthly Billing Report

```python
def generate_monthly_invoice(institution: str, month: str):
    """Generate institutional invoice"""
    queries = audit_db.find({
        "institution": institution,
        "timestamp": {"$gte": f"{month}-01", "$lt": f"{month}-31"}
    })
    
    total_fee = sum(q["fee_charged"] for q in queries)
    
    invoice = {
        "institution": institution,
        "period": month,
        "total_queries": len(queries),
        "total_usdc_charged": total_fee,
        "settlement_amount": total_fee * 0.99,  # 1% AOA fee
        "due_date": "within 30 days",
    }
    
    return invoice
```

---

## Conclusion

The AOA Protocol's API key system creates **transparent, auditable, and efficient** access to satellite verification services while maintaining **institutional accountability** and **global compliance** across different regions.
