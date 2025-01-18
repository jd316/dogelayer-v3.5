// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract WDOGEStaking is ReentrancyGuard, Ownable, Pausable {
    IERC20 public wdoge;
    
    uint256 public rewardRate = 100; // 1% annual reward rate
    uint256 public constant REWARD_PRECISION = 10000;
    
    struct Stake {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardDebt;
    }
    
    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event EmergencyWithdrawn(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    
    constructor(address _wdoge) {
        _transferOwnership(msg.sender);
        wdoge = IERC20(_wdoge);
    }
    
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot stake 0");
        
        // Update rewards before modifying stake
        _updateReward(msg.sender);
        
        // Transfer wDOGE to contract
        require(wdoge.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].timestamp = block.timestamp;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0");
        require(stakes[msg.sender].amount >= amount, "Insufficient stake");
        
        // Update rewards first
        _updateReward(msg.sender);
        
        // Store current reward debt
        uint256 currentReward = stakes[msg.sender].rewardDebt;
        
        // Update stake amount
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
        // Reset reward debt
        stakes[msg.sender].rewardDebt = 0;
        
        // Transfer staked tokens first
        require(wdoge.transfer(msg.sender, amount), "Transfer failed");
        
        // Then transfer rewards if any
        if (currentReward > 0) {
            require(wdoge.transfer(msg.sender, currentReward), "Reward transfer failed");
            emit RewardClaimed(msg.sender, currentReward);
        }
        
        emit Unstaked(msg.sender, amount);
    }
    
    function claimReward() external nonReentrant {
        _updateReward(msg.sender);
        _claimReward(msg.sender);
    }
    
    function _updateReward(address user) internal {
        Stake storage userStake = stakes[user];
        uint256 timeElapsed = block.timestamp - userStake.timestamp;
        
        if (timeElapsed > 0 && userStake.amount > 0) {
            uint256 reward = (userStake.amount * rewardRate * timeElapsed) / (365 days * REWARD_PRECISION);
            userStake.rewardDebt += reward;
            userStake.timestamp = block.timestamp;
        }
    }
    
    function _claimReward(address user) internal {
        uint256 reward = stakes[user].rewardDebt;
        if (reward > 0) {
            stakes[user].rewardDebt = 0;
            require(wdoge.transfer(user, reward), "Reward transfer failed");
            emit RewardClaimed(user, reward);
        }
    }
    
    function setRewardRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Rate too high"); // Max 10% annual reward
        emit RewardRateUpdated(rewardRate, newRate);
        rewardRate = newRate;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function getStakeInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards
    ) {
        Stake memory userStake = stakes[user];
        stakedAmount = userStake.amount;
        
        uint256 timeElapsed = block.timestamp - userStake.timestamp;
        uint256 newRewards = 0;
        
        if (timeElapsed > 0 && userStake.amount > 0) {
            newRewards = (userStake.amount * rewardRate * timeElapsed) / (365 days * REWARD_PRECISION);
        }
        
        pendingRewards = userStake.rewardDebt + newRewards;
    }
    
    function emergencyWithdraw() external nonReentrant {
        require(paused(), "Contract must be paused");
        uint256 stakedAmount = stakes[msg.sender].amount;
        require(stakedAmount > 0, "No stake to withdraw");
        
        // Reset user's stake
        stakes[msg.sender].amount = 0;
        stakes[msg.sender].rewardDebt = 0;
        totalStaked -= stakedAmount;
        
        // Transfer tokens back to user
        require(wdoge.transfer(msg.sender, stakedAmount), "Transfer failed");
        emit EmergencyWithdrawn(msg.sender, stakedAmount);
    }
} 