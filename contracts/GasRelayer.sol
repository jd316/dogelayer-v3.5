// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./WDOGE.sol";

contract GasRelayer is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    WDOGE public immutable wdoge;
    
    // Gas price oracle
    uint256 public gasPrice;
    uint256 public gasPriceLastUpdated;
    uint256 public constant GAS_PRICE_UPDATE_INTERVAL = 1 hours;
    uint256 public constant MAX_PRICE_DEVIATION = 50; // 50% maximum deviation
    uint256 public constant MIN_GAS_PRICE = 1 gwei;
    uint256 public constant MAX_GAS_PRICE = 500 gwei;
    
    // Relayer compensation
    uint256 public relayerFeeMultiplier = 110; // 110% of actual gas cost
    mapping(address => uint256) public relayerBalances;
    uint256 public totalRelayerBalance;
    
    // Circuit breaker
    uint256 public constant MAX_DAILY_COMPENSATION = 1000 ether;
    uint256 public dailyCompensation;
    uint256 public lastDailyReset;
    
    event GasPriceUpdated(uint256 indexed newPrice, uint256 timestamp);
    event RelayerCompensated(address indexed relayer, uint256 amount);
    event PriceDeviationDetected(uint256 oldPrice, uint256 newPrice, uint256 deviation);
    event DailyLimitReset(uint256 timestamp);
    event EmergencyWithdrawal(address indexed token, address indexed recipient, uint256 amount);
    
    error InvalidGasPrice(uint256 price);
    error SuspiciousPriceMovement(uint256 oldPrice, uint256 newPrice);
    error DailyLimitExceeded(uint256 amount, uint256 limit);
    error InsufficientBalance(uint256 requested, uint256 available);
    error TransferFailed();
    
    constructor(address _wdoge) {
        require(_wdoge != address(0), "Invalid WDOGE address");
        wdoge = WDOGE(_wdoge);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        gasPrice = 100 gwei; // Default gas price of 100 gwei
        gasPriceLastUpdated = block.timestamp;
        lastDailyReset = block.timestamp;
    }
    
    function updateGasPrice() external onlyRole(ORACLE_ROLE) whenNotPaused {
        require(block.timestamp >= gasPriceLastUpdated + GAS_PRICE_UPDATE_INTERVAL, "Too soon to update");
        uint256 newGasPrice = tx.gasprice;
        
        // Validate gas price bounds
        if (newGasPrice < MIN_GAS_PRICE || newGasPrice > MAX_GAS_PRICE) {
            revert InvalidGasPrice(newGasPrice);
        }
        
        // Check for suspicious price movements
        if (gasPrice > 0) {
            uint256 deviation = ((newGasPrice > gasPrice ? newGasPrice - gasPrice : gasPrice - newGasPrice) * 100) / gasPrice;
            if (deviation > MAX_PRICE_DEVIATION) {
                revert SuspiciousPriceMovement(gasPrice, newGasPrice);
            }
            
            if (deviation > 30) { // Alert on significant changes
                emit PriceDeviationDetected(gasPrice, newGasPrice, deviation);
            }
        }
        
        gasPrice = newGasPrice;
        gasPriceLastUpdated = block.timestamp;
        emit GasPriceUpdated(gasPrice, block.timestamp);
    }
    
    function resetDailyLimit() internal {
        if (block.timestamp >= lastDailyReset + 1 days) {
            dailyCompensation = 0;
            lastDailyReset = block.timestamp;
            emit DailyLimitReset(block.timestamp);
        }
    }
    
    function estimateGasFee(uint256 gasLimit) public view returns (uint256) {
        return (gasPrice * gasLimit * relayerFeeMultiplier) / 100;
    }
    
    function compensateRelayer(address relayer, uint256 gasUsed) external onlyRole(RELAYER_ROLE) nonReentrant whenNotPaused {
        resetDailyLimit();
        
        uint256 compensation = (gasPrice * gasUsed * relayerFeeMultiplier) / 100;
        
        if (dailyCompensation + compensation > MAX_DAILY_COMPENSATION) {
            revert DailyLimitExceeded(compensation, MAX_DAILY_COMPENSATION - dailyCompensation);
        }
        
        dailyCompensation += compensation;
        relayerBalances[relayer] += compensation;
        totalRelayerBalance += compensation;
        
        emit RelayerCompensated(relayer, compensation);
    }
    
    function withdrawRelayerBalance() external nonReentrant whenNotPaused {
        uint256 balance = relayerBalances[msg.sender];
        if (balance == 0) revert InsufficientBalance(0, 0);
        
        uint256 contractBalance = wdoge.balanceOf(address(this));
        if (contractBalance < balance) {
            revert InsufficientBalance(balance, contractBalance);
        }
        
        relayerBalances[msg.sender] = 0;
        totalRelayerBalance -= balance;
        
        bool success = wdoge.transfer(msg.sender, balance);
        if (!success) revert TransferFailed();
    }
    
    function setRelayerFeeMultiplier(uint256 _multiplier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_multiplier >= 100, "Multiplier must be >= 100");
        require(_multiplier <= 150, "Multiplier must be <= 150");
        relayerFeeMultiplier = _multiplier;
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyWithdraw(address token, address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused(), "Must be paused");
        require(recipient != address(0), "Invalid recipient");
        
        uint256 amount;
        if (token == address(0)) {
            amount = address(this).balance;
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20 tokenContract = IERC20(token);
            amount = tokenContract.balanceOf(address(this));
            require(tokenContract.transfer(recipient, amount), "Token transfer failed");
        }
        
        emit EmergencyWithdrawal(token, recipient, amount);
    }
} 