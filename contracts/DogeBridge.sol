// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./WDOGE.sol";

contract DogeBridge is ReentrancyGuard, AccessControl, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant PREMIUM_USER_ROLE = keccak256("PREMIUM_USER_ROLE");
    
    WDOGE public wdoge;
    uint256 public minDeposit;
    uint256 public maxDeposit;
    uint256 public bridgeFee;
    uint256 public constant RATE_LIMIT_PERIOD = 1 hours;
    uint256 public constant STANDARD_MAX_TXS = 10;
    uint256 public constant PREMIUM_MAX_TXS = 50;
    
    mapping(bytes32 => bool) public processedDeposits;
    mapping(bytes32 => bool) public processedWithdrawals;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => uint256) public transactionCount;
    
    event Deposit(
        address indexed recipient,
        uint256 amount,
        bytes32 depositId
    );
    
    event Withdrawal(
        address indexed sender,
        string dogeAddress,
        uint256 amount,
        bytes32 withdrawalId
    );

    event LimitsUpdated(
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 bridgeFee
    );
    
    constructor(
        address _wdoge,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _bridgeFee
    ) {
        require(_wdoge != address(0), "Invalid WDOGE address");
        wdoge = WDOGE(_wdoge);
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        bridgeFee = _bridgeFee;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(SIGNER_ROLE, msg.sender);
    }

    function checkRateLimit(address user) internal {
        if (block.timestamp >= lastTransactionTime[user] + RATE_LIMIT_PERIOD) {
            transactionCount[user] = 0;
            lastTransactionTime[user] = block.timestamp;
        }
        
        uint256 maxTransactions = hasRole(PREMIUM_USER_ROLE, user) ? PREMIUM_MAX_TXS : STANDARD_MAX_TXS;
        require(transactionCount[user] < maxTransactions, "Rate limit exceeded");
        transactionCount[user]++;
    }

    function verifySignature(
        address recipient,
        uint256 amount,
        bytes32 depositId,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes memory encodedData = abi.encode(recipient, amount, depositId);
        bytes32 messageHash = keccak256(encodedData);
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        return hasRole(SIGNER_ROLE, recoveredSigner);
    }
    
    function processDeposit(
        address recipient,
        uint256 amount,
        bytes32 depositId,
        bytes calldata signature
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        require(!processedDeposits[depositId], "Deposit already processed");
        require(amount >= minDeposit && amount <= maxDeposit, "Invalid amount");
        
        require(verifySignature(recipient, amount, depositId, signature), "Invalid signature");
        checkRateLimit(recipient);
        
        processedDeposits[depositId] = true;
        wdoge.mint(recipient, amount);
        
        emit Deposit(recipient, amount, depositId);
    }
    
    function requestWithdrawal(
        string calldata dogeAddress,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(amount >= minDeposit && amount <= maxDeposit, "Invalid amount");
        require(amount > bridgeFee, "Amount must be greater than fee");
        
        checkRateLimit(msg.sender);
        
        bytes32 withdrawalId = keccak256(
            abi.encode(
                msg.sender,
                dogeAddress,
                amount,
                block.timestamp
            )
        );
        
        require(!processedWithdrawals[withdrawalId], "Withdrawal already processed");
        
        uint256 amountAfterFee = amount - bridgeFee;
        require(IERC20(address(wdoge)).allowance(msg.sender, address(this)) >= amount, "ERC20: insufficient allowance");
        require(IERC20(address(wdoge)).balanceOf(msg.sender) >= amount, "ERC20: insufficient balance");
        
        wdoge.burn(msg.sender, amount);
        processedWithdrawals[withdrawalId] = true;
        
        emit Withdrawal(msg.sender, dogeAddress, amountAfterFee, withdrawalId);
    }
    
    function updateLimits(
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _bridgeFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minDeposit <= _maxDeposit, "Invalid limits");
        require(_bridgeFee < _minDeposit, "Fee too high");
        
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        bridgeFee = _bridgeFee;
        
        emit LimitsUpdated(_minDeposit, _maxDeposit, _bridgeFee);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyWithdraw(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused(), "Contract must be paused");
        if (token == address(0)) {
            payable(msg.sender).transfer(address(this).balance);
        } else {
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            require(balance > 0, "No tokens to withdraw");
            require(tokenContract.transfer(msg.sender, balance), "Transfer failed");
        }
    }
} 