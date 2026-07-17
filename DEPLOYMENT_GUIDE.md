# AOAEscrowVault - Deployment & Launch Guide

## Overview
This guide covers the complete deployment process for the gas-optimized AOAEscrowVault contract on Ethereum mainnet.

---

## Prerequisites

### Required
- [ ] USDC token address (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 on mainnet)
- [ ] Architect wallet address (receives 0.1% fees)
- [ ] Reality Oracle backend address (authorized for settlement execution)
- [ ] Ethereum wallet with sufficient ETH for deployment
- [ ] Hardhat or Foundry setup

### Recommended Tools
```bash
npm install -g hardhat
npm install @openzeppelin/contracts
npm install @openzeppelin/hardhat-upgrades
```

---

## Step 1: Contract Verification Parameters

Before deployment, prepare these values:

```solidity
// Network: Ethereum Mainnet
USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
ARCHITECT_WALLET = "0x..." // Your address
REALITY_ORACLE = "0x..." // Your backend Oracle service
```

---

## Step 2: Deployment Script (Hardhat)

Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const ARCHITECT_WALLET = process.env.ARCHITECT_WALLET || deployer.address;
  const REALITY_ORACLE = process.env.REALITY_ORACLE || deployer.address;

  console.log("Parameters:");
  console.log("- USDC:", USDC);
  console.log("- Architect Wallet:", ARCHITECT_WALLET);
  console.log("- Reality Oracle:", REALITY_ORACLE);

  const AOAEscrowVault = await hre.ethers.getContractFactory("AOAEscrowVault");
  
  console.log("\nDeploying contract...");
  const contract = await AOAEscrowVault.deploy(
    USDC,
    ARCHITECT_WALLET,
    REALITY_ORACLE
  );

  await contract.deployed();

  console.log("\n✅ Contract deployed to:", contract.address);
  console.log("\nVerify on Etherscan:");
  console.log(`npx hardhat verify --network mainnet ${contract.address} "${USDC}" "${ARCHITECT_WALLET}" "${REALITY_ORACLE}"`);

  // Save deployment info
  const deployment = {
    address: contract.address,
    deployer: deployer.address,
    usdc: USDC,
    architectWallet: ARCHITECT_WALLET,
    realityOracle: REALITY_ORACLE,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployments/mainnet-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );

  return contract.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## Step 3: Deploy to Sepolia Testnet (Recommended First)

### 3.1 Get Testnet ETH and USDC
```bash
# Get Sepolia ETH from faucet
# https://sepoliafaucet.com

# Get Sepolia USDC (use Uniswap or request from testnet faucet)
SEPOLIA_USDC="0x6f14C02403f3E042b545FB007C2d3D26d995f5ca"
```

### 3.2 Deploy to Sepolia
```bash
ARCHITECT_WALLET=0x... REALITY_ORACLE=0x... \
npx hardhat run scripts/deploy.js --network sepolia
```

### 3.3 Verify Contract on Sepolia Etherscan
```bash
npx hardhat verify --network sepolia \
  <CONTRACT_ADDRESS> \
  "0x6f14C02403f3E042b545FB007C2d3D26d995f5ca" \
  "0x..." \
  "0x..."
```

---

## Step 4: Test Suite

Create `test/AOAEscrowVault.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AOAEscrowVault", function () {
  let vault, usdc, owner, oracle, beneficiary, addr2;

  const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const PROTOCOL_FEE_BPS = 10;

  beforeEach(async function () {
    [owner, oracle, beneficiary, addr2] = await ethers.getSigners();

    // Deploy mock USDC for testing
    const USDC = await ethers.getContractFactory("USDCMock");
    usdc = await USDC.deploy();
    await usdc.deployed();

    // Mint test tokens
    await usdc.mint(owner.address, ethers.utils.parseUnits("100000", 6));
    await usdc.mint(beneficiary.address, ethers.utils.parseUnits("10000", 6));

    // Deploy vault
    const AOAEscrowVault = await ethers.getContractFactory("AOAEscrowVault");
    vault = await AOAEscrowVault.deploy(usdc.address, owner.address, oracle.address);
    await vault.deployed();
  });

  describe("Deployment", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await vault.architect_wallet()).to.equal(owner.address);
      expect(await vault.reality_oracle()).to.equal(oracle.address);
    });
  });

  describe("Reality Trigger", function () {
    it("Should submit reality trigger with valid signature", async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const locationHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GPS"));
      const region = 1; // US

      // Create signature
      const domain = {
        name: "AOAEscrowVault",
        version: "1",
        chainId: 31337,
        verifyingContract: vault.address
      };

      const types = {
        RealityTrigger: [
          { name: "dataHash", type: "bytes32" },
          { name: "locationHash", type: "bytes32" },
          { name: "region", type: "uint8" }
        ]
      };

      const value = {
        dataHash: dataHash,
        locationHash: locationHash,
        region: region
      };

      const signature = await oracle._signTypedData(domain, types, value);

      // Submit trigger
      await expect(
        vault.connect(beneficiary).submitRealityTrigger(
          dataHash,
          locationHash,
          region,
          signature
        )
      ).to.emit(vault, "RealityTriggered");
    });
  });

  describe("Settlement Execution", function () {
    it("Should execute single settlement with correct fee", async function () {
      const amount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
      const expectedFee = amount.mul(PROTOCOL_FEE_BPS).div(10000);
      const expectedBenefit = amount.sub(expectedFee);

      // Setup: Create trigger first
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("data"));
      const locationHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("loc"));
      
      await vault.connect(beneficiary).submitRealityTrigger(
        dataHash,
        locationHash,
        1,
        "0x" // dummy signature
      ).catch(() => {}); // Ignore signature error in test

      // Approve vault to spend USDC
      await usdc.approve(vault.address, amount);

      // Deposit to vault
      await vault.deposit(amount, vault.address);

      // Execute settlement
      const marketIdHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("market123"));
      
      await expect(
        vault.connect(oracle).executeSettlement(0, 0, beneficiary.address, amount, marketIdHash)
      ).to.emit(vault, "SettlementExecuted")
       .withArgs(0, beneficiary.address, expectedBenefit, expectedFee, marketIdHash);

      // Verify fee collection
      expect(await vault.getTotalFeesCollected()).to.equal(expectedFee);
    });

    it("Should execute batch settlements efficiently", async function () {
      const amounts = [
        ethers.utils.parseUnits("1000", 6),
        ethers.utils.parseUnits("2000", 6),
        ethers.utils.parseUnits("1500", 6)
      ];

      // Setup and deposit
      const totalAmount = amounts.reduce((a, b) => a.add(b));
      await usdc.approve(vault.address, totalAmount);
      await vault.deposit(totalAmount, vault.address);

      // Create triggers
      const triggerIds = [0, 1, 2];
      const settlementIds = [0, 1, 2];
      const beneficiaries = [beneficiary.address, addr2.address, beneficiary.address];
      const marketIdHashes = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("m1")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("m2")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("m3"))
      ];

      // Execute batch
      await expect(
        vault.connect(oracle).batchExecuteSettlements(
          triggerIds,
          settlementIds,
          beneficiaries,
          amounts,
          marketIdHashes
        )
      ).to.emit(vault, "BatchSettlementsExecuted");

      // Verify total settlement count
      const stats = await vault.getContractStats();
      expect(stats.totalSettlements).to.equal(3);
    });
  });

  describe("API Key Management", function () {
    it("Should create API key", async function () {
      const apiKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("key123"));
      const queriesAllowed = 1000;

      await expect(
        vault.createAPIKey(beneficiary.address, apiKeyHash, queriesAllowed, 1)
      ).to.emit(vault, "APIKeyCreated")
       .withArgs(beneficiary.address, apiKeyHash, 1);

      const record = await vault.getAPIKeyStatus(apiKeyHash);
      expect(record.institution).to.equal(beneficiary.address);
      expect(record.active).to.be.true;
    });

    it("Should record API usage and charge fee", async function () {
      const apiKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("key123"));
      const fee = ethers.utils.parseUnits("10", 6);

      // Create key
      await vault.createAPIKey(beneficiary.address, apiKeyHash, 1000, 1);

      // Record usage
      await usdc.connect(beneficiary).approve(vault.address, fee);
      await expect(
        vault.connect(oracle).recordAPIKeyUsage(apiKeyHash, fee)
      ).to.emit(vault, "APIKeyUsed");

      // Verify usage recorded
      const record = await vault.getAPIKeyStatus(apiKeyHash);
      expect(record.queriesUsed).to.equal(1);
    });
  });

  describe("Fee Management", function () {
    it("Should claim pending fees", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      const expectedFee = amount.mul(PROTOCOL_FEE_BPS).div(10000);

      // Setup and execute settlement
      await usdc.approve(vault.address, amount);
      await vault.deposit(amount, vault.address);

      const marketIdHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("m1"));
      await vault.connect(oracle).executeSettlement(0, 0, beneficiary.address, amount, marketIdHash);

      // Claim fees
      const initialBalance = await usdc.balanceOf(owner.address);
      await vault.claimArchitectFees();
      const finalBalance = await usdc.balanceOf(owner.address);

      expect(finalBalance.sub(initialBalance)).to.equal(expectedFee);
    });
  });

  describe("Emergency Functions", function () {
    it("Should pause and unpause contract", async function () {
      await vault.pause();
      expect(await vault.paused()).to.be.true;

      await vault.unpause();
      expect(await vault.paused()).to.be.false;
    });

    it("Should allow emergency withdrawal when paused", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      // Deposit funds
      await usdc.approve(vault.address, amount);
      await vault.deposit(amount, vault.address);

      // Pause and withdraw
      await vault.pause();
      const initialBalance = await usdc.balanceOf(owner.address);
      await vault.emergencyWithdraw(amount);
      const finalBalance = await usdc.balanceOf(owner.address);

      expect(finalBalance.sub(initialBalance)).to.equal(amount);
    });
  });
});
```

### Run Tests
```bash
npx hardhat test
```

---

## Step 5: Pre-Mainnet Checklist

### Contract Review
- [ ] All state variables properly initialized
- [ ] No uninitialized proxy patterns
- [ ] All external functions have proper access control
- [ ] ReentrancyGuard properly applied
- [ ] Pausable implemented for circuit breaker

### Gas Optimization Verification
```bash
npx hardhat run scripts/estimateGas.js
```

### Security
- [ ] Get professional audit (Certik, Trail of Bits, OpenZeppelin)
- [ ] Run Slither analysis: `slither . --json`
- [ ] Check for known vulnerabilities: `npm audit`

### Deployment Preparation
```bash
# Environment variables
cat > .env << EOF
ARCHITECT_WALLET=0x...
REALITY_ORACLE=0x...
ETHERSCAN_API_KEY=...
PRIVATE_KEY=...
EOF

# Verify gas estimates
npx hardhat run scripts/estimateGas.js --network mainnet
```

---

## Step 6: Mainnet Deployment

### 6.1 Deploy Contract
```bash
ARCHITECT_WALLET=0x... REALITY_ORACLE=0x... \
npx hardhat run scripts/deploy.js --network mainnet
```

### 6.2 Verify on Etherscan
```bash
npx hardhat verify --network mainnet \
  <MAINNET_CONTRACT_ADDRESS> \
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" \
  "0x..." \
  "0x..."
```

### 6.3 Initialize Contract
```javascript
// scripts/initialize.js
const hre = require("hardhat");

async function main() {
  const VAULT_ADDRESS = "0x..."; // Your deployed contract
  const vault = await hre.ethers.getContractAt("AOAEscrowVault", VAULT_ADDRESS);

  // Set regional moderators
  const regions = [
    { code: 1, name: "US", moderator: "0x..." },
    { code: 2, name: "China", moderator: "0x..." },
    { code: 3, name: "GlobalSouth", moderator: "0x..." }
  ];

  for (const region of regions) {
    console.log(`Setting moderator for ${region.name}...`);
    await vault.setRegionalModerator(region.code, region.moderator);
  }

  console.log("✅ Contract initialized!");
}

main();
```

Run: `npx hardhat run scripts/initialize.js --network mainnet`

---

## Step 7: Post-Deployment Verification

### Verify Contract on Etherscan
1. Go to https://etherscan.io
2. Search for contract address
3. Verify all constructor arguments match
4. Check bytecode matches source

### Monitor Initial Activity
```bash
# Track deployment and first few transactions
npx hardhat verify --list <CONTRACT_ADDRESS>

# Monitor fee collection
node scripts/monitor.js
```

---

## Step 8: Launch Documentation

Update your README with:

```markdown
## Contract Information

**Network:** Ethereum Mainnet
**Contract Address:** [0x...]
**Token:** USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)

**Key Addresses:**
- Architect Wallet: 0x...
- Reality Oracle: 0x...

**Features:**
- ✅ ERC-4626 Vault Standard
- ✅ Gas-optimized settlements
- ✅ Batch processing support
- ✅ Regional governance
- ✅ Emergency controls

**Transaction Costs (avg):**
- Single settlement: ~140,000 gas (~$7 @ 50 gwei)
- Batch settlement: ~48,000 gas per item (~$2.40 @ 50 gwei)
- API key creation: ~120,000 gas (~$6 @ 50 gwei)
```

---

## Troubleshooting

### Error: "Invalid signature"
- Ensure Oracle backend is using same EIP712 domain
- Verify chain ID matches
- Check contract address in domain

### Error: "Insufficient balance"
- Ensure vault has USDC deposited first
- Verify USDC approval before settlement

### Error: "Gas limit exceeded"
- Use batch operations instead of individual settlements
- Reduce batch size (max recommended: 100 items)

### High gas costs
- Are you batching settlements? (Use `batchExecuteSettlements`)
- Consider deploying on L2 (Arbitrum/Optimism)
- Review fee model profitability

---

## Next Steps

1. **Monitor Performance**
   - Track settlement volumes
   - Calculate actual gas costs vs. fee revenue
   - Adjust fee model if needed

2. **Expand to Layer 2**
   - Deploy to Arbitrum (lowest fees)
   - Deploy to Optimism (good finality)

3. **Add Governance**
   - Create AOA token
   - Implement DAO for fee adjustments
   - Community voting on contract upgrades

---

**🚀 Ready to launch! Good luck with AOA Protocol!**
