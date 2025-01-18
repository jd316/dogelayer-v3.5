// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WDOGE is ERC20, Ownable, Pausable {
    address public bridge;
    
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event EmergencyWithdrawn(address indexed user, uint256 amount);
    
    constructor() ERC20("Wrapped Dogecoin", "wDOGE") {
        _transferOwnership(msg.sender);
        bridge = msg.sender;
    }
    
    function decimals() public pure override returns (uint8) {
        return 8; // Match Dogecoin's 8 decimals
    }
    
    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid bridge address");
        bridge = _bridge;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can mint");
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can burn");
        _burn(from, amount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw() external whenPaused {
        uint256 balance = balanceOf(msg.sender);
        require(balance > 0, "No balance to withdraw");
        
        // Transfer tokens to bridge for unwrapping
        _transfer(msg.sender, bridge, balance);
        
        emit EmergencyWithdrawn(msg.sender, balance);
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
    {
        if (msg.sig != this.emergencyWithdraw.selector) {
            require(!paused(), "Pausable: paused");
        }
        super._beforeTokenTransfer(from, to, amount);
    }
} 