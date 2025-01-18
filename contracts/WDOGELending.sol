// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract WDOGELending is ReentrancyGuard, Ownable, Pausable {
    using Math for uint256;
    
    IERC20 public immutable wdoge;
    
    uint256 public constant COLLATERAL_RATIO = 150; // 150% collateralization required
    uint256 public constant LIQUIDATION_THRESHOLD = 130; // 130% threshold for liquidation
    uint256 public constant INTEREST_RATE = 500; // 5% annual interest rate
    uint256 public constant RATE_PRECISION = 10000;
    uint256 public constant YEAR_IN_SECONDS = 365 days;
    
    struct Loan {
        uint256 amount;
        uint256 collateral;
        uint256 timestamp;
        uint256 interestPaid;
    }
    
    mapping(address => Loan) public loans;
    uint256 public totalLoaned;
    uint256 public totalCollateral;
    
    event LoanCreated(address indexed borrower, uint256 amount, uint256 collateral);
    event LoanRepaid(address indexed borrower, uint256 amount, uint256 interest);
    event CollateralAdded(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event LoanLiquidated(address indexed borrower, address indexed liquidator, uint256 amount);
    
    constructor(address _wdoge) {
        require(_wdoge != address(0), "Invalid WDOGE address");
        _transferOwnership(msg.sender);
        wdoge = IERC20(_wdoge);
    }

    function calculateInterest(uint256 principal, uint256 timeElapsed) public pure returns (uint256) {
        if (principal == 0 || timeElapsed == 0) return 0;
        
        // Use safe math operations to prevent overflow
        uint256 annualInterest = principal * INTEREST_RATE;
        uint256 scaledTime = (timeElapsed * RATE_PRECISION) / YEAR_IN_SECONDS;
        return (annualInterest * scaledTime) / (RATE_PRECISION * RATE_PRECISION);
    }
    
    function getTotalDue(address borrower) public view returns (uint256) {
        Loan memory loan = loans[borrower];
        if (loan.amount == 0) return 0;
        
        uint256 timeElapsed = block.timestamp - loan.timestamp;
        uint256 interest = calculateInterest(loan.amount, timeElapsed);
        return loan.amount + interest - loan.interestPaid;
    }
    
    function getCollateralRatio(address borrower) public view returns (uint256) {
        Loan memory loan = loans[borrower];
        if (loan.amount == 0) return 0;
        
        uint256 totalDue = getTotalDue(borrower);
        if (totalDue == 0) return 0;
        
        return (loan.collateral * 100) / totalDue;
    }
    
    function borrow(uint256 amount, uint256 collateralAmount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot borrow 0");
        require(collateralAmount > 0, "Cannot provide 0 collateral");
        require(loans[msg.sender].amount == 0, "Existing loan must be repaid first");
        
        uint256 requiredCollateral = (amount * COLLATERAL_RATIO) / 100;
        require(collateralAmount >= requiredCollateral, "Insufficient collateral");
        
        require(wdoge.transferFrom(msg.sender, address(this), collateralAmount), "Collateral transfer failed");
        
        loans[msg.sender] = Loan({
            amount: amount,
            collateral: collateralAmount,
            timestamp: block.timestamp,
            interestPaid: 0
        });
        
        totalLoaned += amount;
        totalCollateral += collateralAmount;
        
        require(wdoge.transfer(msg.sender, amount), "Loan transfer failed");
        
        emit LoanCreated(msg.sender, amount, collateralAmount);
    }
    
    function repay(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.amount > 0, "No active loan");
        require(amount > 0, "Cannot repay 0");
        
        uint256 timeElapsed = block.timestamp - loan.timestamp;
        uint256 interest = calculateInterest(loan.amount, timeElapsed);
        uint256 totalDue = loan.amount + interest - loan.interestPaid;
        require(amount <= totalDue, "Amount exceeds loan + interest");
        
        require(wdoge.transferFrom(msg.sender, address(this), amount), "Repayment transfer failed");
        
        if (amount == totalDue) {
            // Full repayment
            totalLoaned -= loan.amount;
            totalCollateral -= loan.collateral;
            require(wdoge.transfer(msg.sender, loan.collateral), "Collateral return failed");
            delete loans[msg.sender];
        } else {
            // Partial repayment
            uint256 remainingInterest = interest - loan.interestPaid;
            uint256 interestPortion = amount > remainingInterest ? remainingInterest : amount;
            uint256 principalPortion = amount - interestPortion;
            
            loan.amount -= principalPortion;
            loan.interestPaid += interestPortion;
            loan.timestamp = block.timestamp;
        }
        
        emit LoanRepaid(msg.sender, amount, interest);
    }
    
    function addCollateral(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot add 0 collateral");
        require(loans[msg.sender].amount > 0, "No active loan");
        
        require(wdoge.transferFrom(msg.sender, address(this), amount), "Collateral transfer failed");
        
        loans[msg.sender].collateral += amount;
        totalCollateral += amount;
        
        emit CollateralAdded(msg.sender, amount);
    }
    
    function withdrawExcessCollateral(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.amount > 0, "No active loan");
        require(amount > 0, "Cannot withdraw 0");
        
        uint256 totalDue = getTotalDue(msg.sender);
        uint256 requiredCollateral = (totalDue * COLLATERAL_RATIO) / 100;
        
        // Calculate excess collateral with a small buffer for rounding
        uint256 excessCollateral = 0;
        if (loan.collateral > requiredCollateral) {
            excessCollateral = loan.collateral - requiredCollateral;
        }
        
        require(excessCollateral > 0, "No excess collateral");
        require(amount <= excessCollateral, "Amount exceeds excess collateral");
        
        loan.collateral -= amount;
        totalCollateral -= amount;
        
        require(wdoge.transfer(msg.sender, amount), "Collateral withdrawal failed");
        
        emit CollateralWithdrawn(msg.sender, amount);
    }
    
    function liquidate(address borrower) external nonReentrant whenNotPaused {
        Loan storage loan = loans[borrower];
        require(loan.amount > 0, "No active loan");
        
        uint256 collateralRatio = getCollateralRatio(borrower);
        require(collateralRatio <= LIQUIDATION_THRESHOLD, "Loan not liquidatable");
        
        uint256 totalDue = getTotalDue(borrower);
        uint256 collateralValue = loan.collateral;
        
        // Transfer collateral to liquidator
        require(wdoge.transfer(msg.sender, collateralValue), "Collateral transfer failed");
        
        // Clear the loan
        totalLoaned -= loan.amount;
        totalCollateral -= loan.collateral;
        delete loans[borrower];
        
        emit LoanLiquidated(borrower, msg.sender, totalDue);
    }
    
    function getLoanInfo(address borrower) external view returns (
        uint256 loanAmount,
        uint256 collateralAmount,
        uint256 interestDue,
        uint256 collateralRatio
    ) {
        Loan memory loan = loans[borrower];
        loanAmount = loan.amount;
        collateralAmount = loan.collateral;
        
        if (loan.amount > 0) {
            uint256 timeElapsed = block.timestamp - loan.timestamp;
            interestDue = calculateInterest(loan.amount, timeElapsed);
            uint256 totalDue = loan.amount + interestDue;
            collateralRatio = totalDue > 0 ? (loan.collateral * 100) / totalDue : 0;
        }
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
} 