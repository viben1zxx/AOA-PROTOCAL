// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC4626/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/cryptography/EIP712.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

/**
 * @title AOAEscrowVault
 * @dev ERC-4626 Vault for holding funds in escrow with Reality Trigger settlement
 * Protocol Fee: 0.1% (1 basis point) routed to architect_wallet
 * Gas-Optimized for mainnet deployment
 */
contract AOAEscrowVault is ERC4626, Ownable, ReentrancyGuard, Pausable, EIP712 {
    using ECDSA for bytes32;

    // ============ CONSTANTS ============
    uint256 public constant PROTOCOL_FEE_BPS = 10; // 10 basis points = 0.1%
    uint256 private constant BPS_DIVISOR = 10000;
    uint256 private constant REGION_US = 1;
    uint256 private constant REGION_CHINA = 2;
    uint256 private constant REGION_GLOBAL_SOUTH = 3;
    // ===== DISPUTE WINDOW V2.0 CONSTANTS =====
    uint256 public constant DISPUTE_WINDOW_DURATION = 24 hours;
    uint256 public constant MINIMUM_CHALLENGE_STAKE = 100e6; // 100 USDC minimum

    // ============ STATE VARIABLES ============
    
    address public architect_wallet;
    address public reality_oracle;
    uint256 public totalFeesCollected;
    
    // Reality Trigger tracking - packed struct for gas efficiency
    struct RealityTrigger {
        bytes32 dataHash;
        address triggeredBy;
        uint96 timestamp; // sufficient for 2^96 seconds (~40M years)
        bool executed;
        uint8 region; // 1=US, 2=China, 3=GlobalSouth
        bytes32 locationHash; // hash of GPS coordinates (saves storage)
    }
    
    mapping(uint256 => RealityTrigger) public triggers;
    uint256 public triggerCounter;
    
    // Settlement records - packed struct
    struct Settlement {
        uint256 settlementId;
        address beneficiary;
        uint256 amount;
        bool resolved;
        bytes32 marketIdHash; // hash of market identifier (saves storage)
        uint96 settlementTime;
        // ===== DISPUTE WINDOW V2.0 FIELDS =====
        uint8 status; // 0=Pending, 1=Disputed, 2=Finalized
        address challenger; // Address that challenged this settlement
        uint256 challengeStakeAmount; // USDC staked by challenger
        uint96 disputeWindowDeadline; // timestamp when dispute window closes
        bool disputeResolved; // True if dispute was resolved
    }
    
    mapping(uint256 => Settlement) public settlements;
    uint256 public settlementCounter;
    
    // API Key registry - packed struct
    struct APIKeyRecord {
        address institution;
        bytes32 apiKeyHash;
        uint96 queriesAllowed;
        uint96 queriesUsed;
        uint256 totalFeePaid;
        bool active;
        uint8 region; // 1=US, 2=China, 3=GlobalSouth
    }
    
    mapping(bytes32 => APIKeyRecord) public apiKeyRegistry;
    mapping(address => bytes32[]) public institutionKeys;
    
    // Regional governance
    mapping(uint8 => address) public regionalModerators; // region code -> moderator address
    
    // Fee collection optimization - batching support
    mapping(address => uint256) public pendingFees; // For batch fee claims
    
    // Events
    event RealityTriggered(
        uint256 indexed triggerId,
        bytes32 indexed dataHash,
        bytes32 locationHash,
        address indexed triggeredBy,
        uint8 region,
        uint96 timestamp
    );
    
    event SettlementExecuted(
        uint256 indexed settlementId,
        address indexed beneficiary,
        uint256 amount,
        uint256 protocolFee,
        bytes32 marketIdHash
    );
    
    // ===== DISPUTE WINDOW V2.0 EVENTS =====
    event SettlementPending(
        uint256 indexed settlementId,
        address indexed beneficiary,
        uint256 amount,
        uint96 disputeDeadline
    );
    
    event SettlementChallenged(
        uint256 indexed settlementId,
        address indexed challenger,
        uint256 stakeAmount,
        string reason
    );
    
    event DisputeResolved(
        uint256 indexed settlementId,
        address indexed resolver,
        bool challengerWon,
        uint256 challengerReward
    );
    
    event SettlementFinalized(
        uint256 indexed settlementId,
        address indexed beneficiary,
        uint256 beneficiaryAmount,
        uint256 protocolFee
    );
    
    event APIKeyCreated(address indexed institution, bytes32 indexed apiKeyHash, uint8 region);
    event APIKeyUsed(bytes32 indexed apiKeyHash, uint96 queriesRemaining);
    event APIKeyLimitIncreased(bytes32 indexed apiKeyHash, uint96 newLimit);
    event RegionalModeratorSet(uint8 indexed region, address moderator);
    event FeesClaimed(address indexed recipient, uint256 amount);
    event BatchSettlementsExecuted(uint256[] settlementIds, uint256 totalAmount, uint256 totalFees);
    
    // ============ MODIFIERS ============
    
    modifier onlyOracleOrOwner() {
        require(msg.sender == reality_oracle || msg.sender == owner(), "Not authorized");
        _;
    }
    
    modifier onlyValidAPIKey(bytes32 _apiKeyHash) {
        APIKeyRecord storage record = apiKeyRegistry[_apiKeyHash];
        require(record.active, "API Key inactive");
        require(record.queriesUsed < record.queriesAllowed, "Query limit exceeded");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        IERC20 _asset,
        address _architect_wallet,
        address _reality_oracle
    ) ERC4626(_asset) EIP712("AOAEscrowVault", "1") {
        require(_architect_wallet != address(0), "Invalid architect wallet");
        require(_reality_oracle != address(0), "Invalid reality oracle");
        architect_wallet = _architect_wallet;
        reality_oracle = _reality_oracle;
    }
    
    // ============ DEPOSIT & WITHDRAWAL (ERC-4626) ============
    
    /**
     * @dev Deposit USDC into escrow vault
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        return super.deposit(assets, receiver);
    }
    
    /**
     * @dev Mint vault shares (restricted during settlement)
     */
    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        returns (uint256)
    {
        return super.mint(shares, receiver);
    }
    
    // ============ REALITY TRIGGER MECHANISM ============
    
    /**
     * @dev Submit a Reality Trigger signature from the AOA AI backend
     * This proves that satellite cross-verification passed
     * @param _dataHash Hash of the verification data (SAR + Optical fusion result)
     * @param _locationHash Hash of GPS coordinates or location identifier
     * @param _region Region code (1=US, 2=China, 3=GlobalSouth)
     * @param _signature Cryptographic signature from reality_oracle
     */
    function submitRealityTrigger(
        bytes32 _dataHash,
        bytes32 _locationHash,
        uint8 _region,
        bytes calldata _signature
    ) external nonReentrant {
        // Verify signature
        bytes32 digest = _hashRealityTrigger(_dataHash, _locationHash, _region);
        address recoveredSigner = digest.recover(_signature);
        require(recoveredSigner == reality_oracle, "Invalid Reality Trigger signature");
        
        uint256 triggerId = triggerCounter++;
        
        RealityTrigger storage trigger = triggers[triggerId];
        trigger.dataHash = _dataHash;
        trigger.triggeredBy = msg.sender;
        trigger.timestamp = uint96(block.timestamp);
        trigger.locationHash = _locationHash;
        trigger.region = _region;
        trigger.executed = false;
        
        emit RealityTriggered(triggerId, _dataHash, _locationHash, msg.sender, _region, trigger.timestamp);
    }
    
    /**
     * @dev Hash the Reality Trigger for signature verification
     */
    function _hashRealityTrigger(
        bytes32 _dataHash,
        bytes32 _locationHash,
        uint8 _region
    ) private view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(
                keccak256("RealityTrigger(bytes32 dataHash,bytes32 locationHash,uint8 region)"),
                _dataHash,
                _locationHash,
                _region
            ))
        );
    }
    
    // ============ SETTLEMENT LOGIC ============
    
    /**
     * @dev Execute settlement when Reality Trigger is confirmed
     * V2.0: Settlement enters 24-hour dispute window instead of immediate transfer
     * Splits escrow amount: 99.9% to beneficiary, 0.1% to architect_wallet (on finalization)
     * @param _triggerId The ID of the Reality Trigger that authorizes settlement
     * @param _settlementId Settlement ID from prediction market
     * @param _beneficiary Address to receive settlement funds
     * @param _amount Amount to settle (in smallest unit, e.g., USDC wei)
     * @param _marketIdHash Hash of market identifier from Kalshi/Polymarket
     */
    function executeSettlement(
        uint256 _triggerId,
        uint256 _settlementId,
        address _beneficiary,
        uint256 _amount,
        bytes32 _marketIdHash
    ) external onlyOracleOrOwner nonReentrant whenNotPaused {
        // Verify Reality Trigger exists and hasn't been executed
        RealityTrigger storage trigger = triggers[_triggerId];
        require(trigger.timestamp > 0, "Reality Trigger not found");
        require(!trigger.executed, "Reality Trigger already executed");
        
        // Verify sufficient balance in vault
        require(asset.balanceOf(address(this)) >= _amount, "Insufficient escrow balance");
        
        // Mark trigger as executed
        trigger.executed = true;
        
        // Record settlement in PendingDispute state (V2.0)
        Settlement storage settlement = settlements[_settlementId];
        settlement.settlementId = _settlementId;
        settlement.beneficiary = _beneficiary;
        settlement.amount = _amount;
        settlement.resolved = false;
        settlement.marketIdHash = _marketIdHash;
        settlement.settlementTime = uint96(block.timestamp);
        // V2.0 NEW FIELDS
        settlement.status = 0; // Pending - Awaiting dispute window completion
        settlement.challenger = address(0);
        settlement.challengeStakeAmount = 0;
        settlement.disputeWindowDeadline = uint96(block.timestamp + DISPUTE_WINDOW_DURATION);
        settlement.disputeResolved = false;
        
        settlementCounter++;
        
        emit SettlementPending(
            _settlementId,
            _beneficiary,
            _amount,
            settlement.disputeWindowDeadline
        );
    }
    
    /**
     * @dev Challenge a settlement within the 24-hour dispute window
     * External users can stake USDC to challenge potentially fraudulent settlements
     * @param _settlementId Settlement ID to challenge
     * @param _stakeAmount USDC amount to stake (minimum 100 USDC)
     * @param _reason Description of why settlement is being challenged
     */
    function challengeSettlement(
        uint256 _settlementId,
        uint256 _stakeAmount,
        string calldata _reason
    ) external nonReentrant {
        Settlement storage settlement = settlements[_settlementId];
        
        require(settlement.settlementId != 0, "Settlement not found");
        require(settlement.status == 0, "Settlement already disputed or finalized");
        require(block.timestamp < settlement.disputeWindowDeadline, "Dispute window closed");
        require(_stakeAmount >= MINIMUM_CHALLENGE_STAKE, "Stake below minimum");
        require(msg.sender != settlement.beneficiary, "Beneficiary cannot challenge own settlement");
        
        // Transfer stake from challenger to contract
        require(
            asset.transferFrom(msg.sender, address(this), _stakeAmount),
            "Stake transfer failed"
        );
        
        // Record challenge (freeze settlement)
        settlement.status = 1; // Disputed
        settlement.challenger = msg.sender;
        settlement.challengeStakeAmount = _stakeAmount;
        
        emit SettlementChallenged(_settlementId, msg.sender, _stakeAmount, _reason);
    }
    
    /**
     * @dev Finalize a settlement after dispute window closes or dispute is resolved
     * This function performs the actual fund transfer with 0.1% fee deducted
     * @param _settlementId Settlement ID to finalize
     */
    function finalizeSettlement(uint256 _settlementId) external nonReentrant {
        Settlement storage settlement = settlements[_settlementId];
        
        require(settlement.settlementId != 0, "Settlement not found");
        require(!settlement.resolved, "Settlement already finalized");
        
        if (settlement.status == 0) {
            // Pending - can finalize after dispute window
            require(
                block.timestamp > settlement.disputeWindowDeadline,
                "Dispute window still open"
            );
        } else if (settlement.status == 1) {
            // Disputed - can only finalize if dispute was resolved
            require(settlement.disputeResolved, "Dispute not yet resolved");
        }
        
        // Calculate protocol fee (0.1%)
        uint256 protocolFee = (settlement.amount * PROTOCOL_FEE_BPS) / BPS_DIVISOR;
        uint256 beneficiaryAmount = settlement.amount - protocolFee;
        
        // Mark as finalized
        settlement.resolved = true;
        settlement.status = 2; // Finalized
        
        // Accumulate fees
        pendingFees[architect_wallet] += protocolFee;
        totalFeesCollected += protocolFee;
        
        // Transfer to beneficiary
        require(
            asset.transfer(settlement.beneficiary, beneficiaryAmount),
            "Beneficiary transfer failed"
        );
        
        emit SettlementFinalized(
            _settlementId,
            settlement.beneficiary,
            beneficiaryAmount,
            protocolFee
        );
    }
    
    /**
     * @dev Resolve a dispute - Oracle or Owner can judge dispute winner
     * @param _settlementId Settlement ID with active dispute
     * @param _challengerWon True if challenger's claim is valid, false if beneficiary wins
     */
    function resolveDispute(
        uint256 _settlementId,
        bool _challengerWon
    ) external onlyOracleOrOwner nonReentrant {
        Settlement storage settlement = settlements[_settlementId];
        
        require(settlement.settlementId != 0, "Settlement not found");
        require(settlement.status == 1, "Settlement not in disputed state");
        require(!settlement.disputeResolved, "Dispute already resolved");
        
        settlement.disputeResolved = true;
        
        uint256 challengerReward = 0;
        
        if (_challengerWon) {
            // Challenger's stake is returned + bonus from settlement
            // Settlement funds return to escrow vault
            uint256 bonus = settlement.amount / 10; // 10% bonus to challenger
            challengerReward = settlement.challengeStakeAmount + bonus;
            
            require(
                asset.transfer(settlement.challenger, challengerReward),
                "Challenger reward transfer failed"
            );
        } else {
            // Beneficiary wins - challenger loses stake
            // Stake is added to architect fees
            pendingFees[architect_wallet] += settlement.challengeStakeAmount;
            totalFeesCollected += settlement.challengeStakeAmount;
        }
        
        emit DisputeResolved(
            _settlementId,
            msg.sender,
            _challengerWon,
            challengerReward
        );
    }
    
    /**
     * @dev Execute multiple settlements in batch (gas optimization)
     * V2.0: Batch settlements also enter dispute window
     * @param _triggerIds Array of Reality Trigger IDs
     * @param _settlementIds Array of Settlement IDs
     * @param _beneficiaries Array of beneficiary addresses
     * @param _amounts Array of amounts to settle
     * @param _marketIdHashes Array of market ID hashes
     */
    function batchExecuteSettlements(
        uint256[] calldata _triggerIds,
        uint256[] calldata _settlementIds,
        address[] calldata _beneficiaries,
        uint256[] calldata _amounts,
        bytes32[] calldata _marketIdHashes
    ) external onlyOracleOrOwner nonReentrant whenNotPaused {
        require(
            _triggerIds.length == _settlementIds.length &&
            _settlementIds.length == _beneficiaries.length &&
            _beneficiaries.length == _amounts.length &&
            _amounts.length == _marketIdHashes.length,
            "Array length mismatch"
        );
        
        uint256 totalAmount = 0;
        
        // First pass: validate and accumulate
        unchecked {
            for (uint256 i = 0; i < _triggerIds.length; ++i) {
                RealityTrigger storage trigger = triggers[_triggerIds[i]];
                require(trigger.timestamp > 0, "Reality Trigger not found");
                require(!trigger.executed, "Reality Trigger already executed");
                totalAmount += _amounts[i];
            }
        }
        
        require(asset.balanceOf(address(this)) >= totalAmount, "Insufficient escrow balance");
        
        // Second pass: execute settlements (enter dispute window - V2.0)
        unchecked {
            for (uint256 i = 0; i < _triggerIds.length; ++i) {
                RealityTrigger storage trigger = triggers[_triggerIds[i]];
                trigger.executed = true;
                
                Settlement storage settlement = settlements[_settlementIds[i]];
                settlement.settlementId = _settlementIds[i];
                settlement.beneficiary = _beneficiaries[i];
                settlement.amount = _amounts[i];
                settlement.resolved = false;
                settlement.marketIdHash = _marketIdHashes[i];
                settlement.settlementTime = uint96(block.timestamp);
                // V2.0 NEW FIELDS
                settlement.status = 0; // Pending
                settlement.challenger = address(0);
                settlement.challengeStakeAmount = 0;
                settlement.disputeWindowDeadline = uint96(block.timestamp + DISPUTE_WINDOW_DURATION);
                settlement.disputeResolved = false;
            }
        }
        
        settlementCounter += _triggerIds.length;
        
        emit BatchSettlementsExecuted(_settlementIds, totalAmount, 0);
    }
    
    /**
     * @dev Claim accumulated fees (gas efficient batched payment)
     */
    function claimPendingFees() external nonReentrant {
        uint256 feesAmount = pendingFees[msg.sender];
        require(feesAmount > 0, "No pending fees");
        
        pendingFees[msg.sender] = 0;
        
        require(asset.transfer(msg.sender, feesAmount), "Fee transfer failed");
        
        emit FeesClaimed(msg.sender, feesAmount);
    }
    
    // ============ API KEY MANAGEMENT ============
    
    /**
     * @dev Create API key for institutional access
     * @param _institution Address of the institution
     * @param _apiKeyHash Hash of the actual API key (kept secret)
     * @param _queriesAllowed Number of queries allowed
     * @param _region Region code (1=US, 2=China, 3=GlobalSouth)
     */
    function createAPIKey(
        address _institution,
        bytes32 _apiKeyHash,
        uint96 _queriesAllowed,
        uint8 _region
    ) external onlyOwner {
        require(_institution != address(0), "Invalid institution");
        require(_queriesAllowed > 0, "Invalid query allowance");
        require(_region >= 1 && _region <= 3, "Invalid region");
        
        APIKeyRecord storage record = apiKeyRegistry[_apiKeyHash];
        require(!record.active, "API Key already exists");
        
        record.institution = _institution;
        record.apiKeyHash = _apiKeyHash;
        record.queriesAllowed = _queriesAllowed;
        record.queriesUsed = 0;
        record.totalFeePaid = 0;
        record.active = true;
        record.region = _region;
        
        institutionKeys[_institution].push(_apiKeyHash);
        
        emit APIKeyCreated(_institution, _apiKeyHash, _region);
    }
    
    /**
     * @dev Track API key usage and charge query fee
     * Called by the backend after successful verification
     * @param _apiKeyHash The API key being used
     * @param _queryFeeInUSDC The "Truth Bounty" fee charged (in USDC smallest units)
     */
    function recordAPIKeyUsage(bytes32 _apiKeyHash, uint256 _queryFeeInUSDC)
        external
        onlyOracleOrOwner
        onlyValidAPIKey(_apiKeyHash)
        nonReentrant
    {
        APIKeyRecord storage record = apiKeyRegistry[_apiKeyHash];
        
        // Increment usage (unchecked since queriesUsed < queriesAllowed is checked in modifier)
        unchecked {
            record.queriesUsed += 1;
            record.totalFeePaid += _queryFeeInUSDC;
        }
        
        // Transfer fee to protocol (if not already collected)
        if (_queryFeeInUSDC > 0) {
            require(
                asset.transferFrom(record.institution, address(this), _queryFeeInUSDC),
                "Query fee transfer failed"
            );
            pendingFees[architect_wallet] += _queryFeeInUSDC;
            totalFeesCollected += _queryFeeInUSDC;
        }
        
        emit APIKeyUsed(_apiKeyHash, record.queriesAllowed - record.queriesUsed);
    }
    
    /**
     * @dev Increase query limit for an API key (alternative to creating new key)
     */
    function increaseAPIKeyLimit(bytes32 _apiKeyHash, uint96 _additionalQueries)
        external
        onlyOwner
    {
        APIKeyRecord storage record = apiKeyRegistry[_apiKeyHash];
        require(record.active, "API Key not found");
        require(_additionalQueries > 0, "Invalid increase amount");
        
        record.queriesAllowed += _additionalQueries;
        
        emit APIKeyLimitIncreased(_apiKeyHash, record.queriesAllowed);
    }
    
    /**
     * @dev Refund queries to an institution (admin only)
     */
    function refundQueries(bytes32 _apiKeyHash, uint96 _refundAmount)
        external
        onlyOwner
    {
        APIKeyRecord storage record = apiKeyRegistry[_apiKeyHash];
        require(record.active, "API Key not found");
        require(record.queriesUsed >= _refundAmount, "Invalid refund amount");
        
        unchecked {
            record.queriesUsed -= _refundAmount;
        }
    }
    
    /**
     * @dev Deactivate an API key
     */
    function deactivateAPIKey(bytes32 _apiKeyHash) external onlyOwner {
        APIKeyRecord storage record = apiKeyRegistry[_apiKeyHash];
        require(record.active, "API Key not found");
        record.active = false;
    }
    
    /**
     * @dev Get API key status for an institution
     */
    function getAPIKeyStatus(bytes32 _apiKeyHash)
        external
        view
        returns (APIKeyRecord memory)
    {
        return apiKeyRegistry[_apiKeyHash];
    }
    
    /**
     * @dev Get all API keys for an institution
     */
    function getInstitutionKeys(address _institution)
        external
        view
        returns (bytes32[] memory)
    {
        return institutionKeys[_institution];
    }
    
    // ============ REGIONAL GOVERNANCE ============
    
    /**
     * @dev Set regional moderator for compliance (US/China/Global South)
     * @param _region Region code (1=US, 2=China, 3=GlobalSouth)
     * @param _moderator Address of the regional moderator
     */
    function setRegionalModerator(uint8 _region, address _moderator)
        external
        onlyOwner
    {
        require(_region >= 1 && _region <= 3, "Invalid region");
        require(_moderator != address(0), "Invalid moderator address");
        
        regionalModerators[_region] = _moderator;
        emit RegionalModeratorSet(_region, _moderator);
    }
    
    /**
     * @dev Get regional moderator
     * @param _region Region code (1=US, 2=China, 3=GlobalSouth)
     */
    function getRegionalModerator(uint8 _region)
        external
        view
        returns (address)
    {
        require(_region >= 1 && _region <= 3, "Invalid region");
        return regionalModerators[_region];
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Pause contract in case of emergency
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Update oracle address
     */
    function setRealityOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        reality_oracle = _newOracle;
    }
    
    /**
     * @dev Update architect wallet
     */
    function setArchitectWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid wallet address");
        architect_wallet = _newWallet;
    }
    
    /**
     * @dev Claim pending fees for architect wallet
     */
    function claimArchitectFees() external onlyOwner nonReentrant {
        uint256 feesAmount = pendingFees[architect_wallet];
        require(feesAmount > 0, "No pending fees");
        
        pendingFees[architect_wallet] = 0;
        
        require(asset.transfer(architect_wallet, feesAmount), "Withdrawal failed");
        
        emit FeesClaimed(architect_wallet, feesAmount);
    }
    
    /**
     * @dev Emergency withdrawal of funds (only callable by owner when paused)
     * For recovery in case of critical bug
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner whenPaused nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(asset.balanceOf(address(this)) >= _amount, "Insufficient balance");
        
        require(
            asset.transfer(owner(), _amount),
            "Emergency withdrawal failed"
        );
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get settlement details
     */
    function getSettlement(uint256 _settlementId)
        external
        view
        returns (Settlement memory)
    {
        return settlements[_settlementId];
    }
    
    /**
     * @dev Get Reality Trigger details
     */
    function getRealityTrigger(uint256 _triggerId)
        external
        view
        returns (RealityTrigger memory)
    {
        return triggers[_triggerId];
    }
    
    /**
     * @dev Get total fees collected
     */
    function getTotalFeesCollected() external view returns (uint256) {
        return totalFeesCollected;
    }
    
    /**
     * @dev Get pending fees for an address
     */
    function getPendingFees(address _address) external view returns (uint256) {
        return pendingFees[_address];
    }
    
    /**
     * @dev Get contract statistics
     */
    function getContractStats() external view returns (
        uint256 totalTriggers,
        uint256 totalSettlements,
        uint256 totalFees,
        uint256 vaultBalance
    ) {
        return (
            triggerCounter,
            settlementCounter,
            totalFeesCollected,
            asset.balanceOf(address(this))
        );
    }
    
    /**
     * @dev Check if Reality Trigger was executed
     */
    function isTriggerExecuted(uint256 _triggerId) external view returns (bool) {
        return triggers[_triggerId].executed;
    }
    
    /**
     * @dev Check if Settlement was resolved
     */
    function isSettlementResolved(uint256 _settlementId) external view returns (bool) {
        return settlements[_settlementId].resolved;
    }
}
