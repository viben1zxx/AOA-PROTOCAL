# AOA (Autonomous Orbital Auditor) Protocol

## 🛰️ Overview

**AOA Protocol** is the world's first decentralized "Truth-as-a-Service" platform that uses satellite fusion (SAR + Optical) to verify physical reality for multi-million dollar contracts. The system bypasses human reports and deepfakes by providing cryptographic, orbital proof for settlement of:

- **Prediction Markets** (Kalshi, Polymarket)
- **Insurance Claims** (commodity, shipping, supply chain)
- **Commodity Trading** (oil tankers, agricultural yields, factory output)
- **Supply Chain Verification** (port activity, manufacturing)

---

## 🏗️ System Architecture

### Phase 1: Reality Fusion Engine (Backend)

**Multi-Spectral Ingestion Service** (`reality_fusion_engine.py`)
- Ingests real-time data from **Sentinel-1 (SAR)** and **Sentinel-2 (Optical)** satellites
- Processes radar backscatter and optical reflectivity data
- Handles 10m-30m resolution imagery across entire globe

**Cross-Verification Algorithm**
- Compares SAR intensity with Optical brightness
- Detects "Synthetic Anomalies": when optical shows object but radar doesn't detect mass
- Detects "Missing Mass": when radar shows return but optical doesn't show object
- Confidence scoring: 0-100% based on SAR-Optical correlation

**Autonomous Scouting Agent** (LangChain)
- Monitors Kalshi and Polymarket APIs for "Physical Settlement" keywords
- Extracts GPS coordinates from market descriptions
- Auto-triggers satellite scans for relevant locations
- Continuous monitoring loop every 5 minutes

**ZK-SNARK Privacy Layer**
- Generates zero-knowledge proofs proving asset state WITHOUT revealing location
- Allows hedge funds to verify factory closure privately
- No public disclosure of monitored assets

### Phase 2: Command Center (Frontend)

**Global Reality Map** (Next.js + Mapbox GL)
- Interactive satellite map with real-time verification points
- Displays 2 types of markers:
  - 🟢 **Green**: Physical assets verified
  - 🔴 **Red**: Synthetic anomalies detected

**Digital Fencing Tool**
- Draw polygons over Port, Factory, Farm, or Asset coordinates
- Polygon-based verification triggering
- Real-time scanning within defined areas

**Reliability Score Dashboard**
- SAR Intensity bar (proxy for physical mass)
- Optical Brightness bar (proxy for reflectivity)
- SAR-Optical Correlation percentage
- 0-100% confidence score

**Proof-of-Reality Report Generator**
- Cryptographically signed JSON/PDF reports
- Contains verification hash, timestamp, confidence score
- Stores immutable copy on IPFS
- Legal-grade certification levels (High/Medium/Low)

### Phase 3: Smart Contract Settlement

**AOAEscrowVault.sol** (ERC-4626 Compatible)

**Key Features:**
- Holds funds in escrow until Reality Trigger is confirmed
- **0.1% Protocol Fee** (10 basis points) automatically routed to `architect_wallet`
- Settlement splits: 99.9% to beneficiary, 0.1% to AOA
- Supports API key registry for institutional access
- Regional governance (US/China/Global South compliance)

**Reality Trigger Mechanism**
- Backend sends cryptographically signed "Reality Trigger" to smart contract
- Signature proves satellite verification passed
- Unlocks escrow and executes settlement
- Immutable settlement records stored on-chain

**API Key Management**
- Per-query "Truth Bounty" in USDC
- Tracks institutional usage and fees
- Query limits and rate limiting
- Regional access control

### Phase 4: Global Scaling & Privacy

**Regional Adaptation:**
- **US**: Legal/Compliance - Use for insurance claims, commodity swaps
- **China**: Industrial/Supply-Chain - Port monitoring, factory verification
- **Global South**: P2P/Trustless Trade - Decentralized commodity settlement

**ZK-SNARK Privacy:**
- Verify factory is closed WITHOUT revealing which factory
- Prove oil tanker is in port WITHOUT revealing port details
- Hedge funds maintain competitive secrecy

---

## 📁 Project Structure

```
AOA-Protocol/
├── README.md                          # This file
├── package.json                       # Next.js dependencies
├── requirements.txt                   # Python dependencies
├── tsconfig.json                      # TypeScript config
├── tailwind.config.js                 # Tailwind styling
│
├── AOAEscrowVault.sol                 # Solidity smart contract (ERC-4626)
├── reality_fusion_engine.py           # Python backend service
│
├── app/
│   ├── layout.tsx                     # Root layout
│   ├── globals.css                    # Global styles
│   └── dashboard/
│       └── page.tsx                   # Main dashboard
│
├── components/
│   ├── GlobalMap.tsx                  # Mapbox integration + digital fencing
│   ├── ReliabilityScore.tsx           # Confidence score visualization
│   ├── VerificationPanel.tsx          # Verification details
│   ├── ReportGenerator.tsx            # Proof report creation
│   ├── Navbar.tsx                     # Navigation bar
│   └── Providers.tsx                  # React Query + Toast providers
│
├── lib/
│   ├── apiClient.ts                   # Backend API client
│   └── reportGenerator.ts             # Proof report generation
│
├── store/
│   └── verificationStore.ts           # Zustand state management
│
└── types/
    └── verification.ts                # TypeScript type definitions
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- Mapbox token (free tier available)
- Web3 provider (Infura, Alchemy, etc.)

### Installation

#### 1. **Backend Setup** (Python)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export COPERNICUS_USERNAME="your_username"
export COPERNICUS_PASSWORD="your_password"
export OPENAI_API_KEY="your_key"
export WEB3_PROVIDER="https://mainnet.infura.io/v3/YOUR_KEY"
export PRIVATE_KEY="0x..."

# Run the Reality Fusion Engine
python reality_fusion_engine.py
```

#### 2. **Frontend Setup** (Next.js)

```bash
# Install dependencies
npm install

# Set environment variables
echo 'NEXT_PUBLIC_MAPBOX_TOKEN=your_token' > .env.local
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api' >> .env.local

# Run development server
npm run dev

# Open http://localhost:3000/dashboard
```

#### 3. **Smart Contract Deployment**

```bash
# Using Hardhat
npx hardhat compile
npx hardhat run scripts/deploy.js --network mainnet

# Contract addresses will be logged - save to .env
```

---

## 🔐 Smart Contract Functions

### Core Settlement Functions

```solidity
// Submit Reality Trigger from AOA backend
submitRealityTrigger(bytes32 _dataHash, string _location, bytes _signature)

// Execute settlement when Reality Trigger is confirmed
executeSettlement(
  uint256 _triggerId,
  uint256 _settlementId,
  address _beneficiary,
  uint256 _amount,
  string _marketId
)
```

### API Key Management

```solidity
// Create API key for institution
createAPIKey(address _institution, bytes32 _apiKeyHash, uint256 _queriesAllowed, string _region)

// Track usage and charge query fee
recordAPIKeyUsage(bytes32 _apiKeyHash, uint256 _queryFeeInUSDC)

// Get API key status
getAPIKeyStatus(bytes32 _apiKeyHash) returns (APIKeyRecord)
```

### Fee Structure

- **Protocol Fee**: 0.1% (10 basis points) of settlement amount
- **Query Fee**: $50-$500 per verification (variable by region)
- **Annual API Subscription**: $10,000+ (for institutions like Kalshi)

---

## 🛰️ Python Backend API

### 1. **Multi-Spectral Ingestion**

```python
ingester = SatelliteDataIngester(config)

sar_data = await ingester.fetch_sentinel1_sar(
    latitude=1.2558,
    longitude=103.7618,
    start_date=datetime.now() - timedelta(days=7),
    end_date=datetime.now()
)

optical_data = await ingester.fetch_sentinel2_optical(
    latitude=1.2558,
    longitude=103.7618,
    start_date=datetime.now() - timedelta(days=7),
    end_date=datetime.now()
)
```

### 2. **Cross-Verification**

```python
verifier = CrossVerificationEngine()

result = verifier.verify(sar_data, optical_data)
# Returns VerificationResult with:
# - is_physical: bool
# - confidence_score: 0-100%
# - anomaly_type: str | None ("SYNTHETIC", "MISSING_MASS", etc.)
# - verification_hash: cryptographic hash
```

### 3. **Reality Trigger Generation**

```python
trigger_manager = RealityTriggerManager(config)

trigger = trigger_manager.generate_reality_trigger(
    verification_result=result,
    market_id="KALSHI_OIL_TANKER_Q2"
)

tx_hash = trigger_manager.submit_to_contract(trigger)
```

### 4. **Autonomous Market Scouting**

```python
agent = AutonomousScoutingAgent(config)
agent.run_scouting_loop()  # Runs indefinitely
# Monitors Kalshi/Polymarket every 5 minutes
# Triggers satellite scans automatically
```

---

## 🖥️ Frontend API Endpoints

### Dashboard
```
GET  /dashboard                  # Main dashboard
POST /api/verifications          # Fetch all verifications
POST /api/verifications/initiate # Trigger new verification
GET  /api/triggers/recent        # Fetch recent Reality Triggers
```

### Report Generation
```
POST /api/reports/generate       # Generate Proof-of-Reality report
POST /api/reports/export-pdf     # Export report as PDF
```

### Market Integration
```
GET  /api/markets/kalshi         # Fetch Kalshi markets
GET  /api/markets/polymarket     # Fetch Polymarket contracts
```

---

## 💰 Revenue Model

### 1. **Per-Query Settlement Fee (0.1%)**
- Every settlement automatically routes 0.1% to `architect_wallet`
- Example: $1M prediction market = $1,000 fee

### 2. **API Subscription (Institutional)**
- Kalshi: $50,000/year for real-time integration
- Polymarket: $30,000/year
- Insurance companies: $100,000+/year

### 3. **Regional Licensing**
- US operators: 2% of total revenue
- China industrial partners: 3%
- Global South P2P networks: 1%

---

## 🔒 Security Considerations

### Smart Contract
- ERC-4626 standard vault pattern (battle-tested)
- Reentrancy guards on all external calls
- Role-based access control (owner, oracle, moderators)
- Emergency pause mechanism

### Backend
- HTTPS-only API calls
- Private key stored in environment variables
- Digital signatures on Reality Triggers
- Rate limiting on API endpoints

### Frontend
- CSP headers to prevent XSS
- JWT authentication for institutional access
- Wallet signature verification for user actions

---

## 🧪 Testing

### Unit Tests (Python)
```bash
pytest tests/test_cross_verification.py -v
pytest tests/test_satellite_ingestion.py -v
```

### Integration Tests (Smart Contract)
```bash
npx hardhat test
```

### E2E Tests (Frontend)
```bash
npm run test:e2e
```

---

## 📚 Key References

- **Sentinel-1 Documentation**: https://sentinel.esa.int/web/sentinel/user-guides/sentinel-1-sar
- **Sentinel-2 Documentation**: https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi
- **ERC-4626 Standard**: https://eips.ethereum.org/EIPS/eip-4626
- **ZK-SNARKs**: https://en.wikipedia.org/wiki/Zero-knowledge_proof
- **LangChain Documentation**: https://python.langchain.com

---

## 🤝 Contributing

Contributions welcome! Areas for collaboration:

1. **SAR/Optical ML Models** - Improve anomaly detection accuracy
2. **Regional Compliance** - Add GDPR/CCPA privacy controls
3. **Market Integrations** - Connect to additional prediction markets
4. **ZK-SNARK Circuits** - Implement full zk-SNARK privacy
5. **Mobile App** - React Native dashboard for field operators

---

## 📝 License

MIT License - See LICENSE file for details

---

## 📧 Contact

**AOA Protocol Team**
- Email: architects@aoa-protocol.io
- Discord: https://discord.gg/aoa-protocol
- GitHub: https://github.com/aoa-protocol

---

## ⚠️ Disclaimer

This is an MVP (Minimum Viable Product). For production use:

1. **Audit the smart contract** with professional security firms (OpenZeppelin, Trail of Bits)
2. **Test satellite data pipelines** extensively with real Sentinel data
3. **Comply with local regulations** on satellite data usage and cross-border data transfer
4. **Obtain proper licenses** for operating as an oracle service

This technology is powerful but must be used responsibly.

---

**Built with 🛰️ for global financial truth.**
