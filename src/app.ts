import express, { Request, Response, Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { ethers } from 'ethers';
import { db } from './database';
import { DogecoinP2PKH } from './services/dogecoin/scripts/p2pkh';
import { WDOGEStaking__factory, WDOGELending__factory } from '../typechain-types';

const app = express();
const router = Router();

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(express.json());
app.use(limiter);

interface DepositRequest {
  amount: string;
  userAddress: string;
}

interface WithdrawalRequest {
  amount: string;
  dogecoinAddress: string;
  userAddress: string;
}

interface TransactionParams {
  id: string;
}

interface UserParams {
  address: string;
}

interface StakingRequest {
  amount: string;
  userAddress: string;
}

interface LendingRequest {
  amount: string;
  collateral: string;
  userAddress: string;
}

interface TransactionQuery {
  address?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// Create a new deposit request
const createDeposit: RequestHandler<{}, any, DepositRequest> = async (req, res) => {
  try {
    const { amount, userAddress } = req.body;

    // Validate amount
    const amountFloat = parseFloat(amount);
    if (amountFloat < 1.0) {
      res.status(400).json({ error: 'Amount below minimum deposit of 1 DOGE' });
      return;
    }

    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }

    // Generate a new Dogecoin address
    const p2pkh = new DogecoinP2PKH(process.env.OPERATOR_KEY || '');
    const depositAddress = await p2pkh.generateAddress();

    // Create user if not exists
    await db('users').insert({ address: userAddress }).onConflict('address').ignore();

    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'deposit',
      status: 'pending',
      amount: amountFloat,
      user_address: userAddress,
      dogecoin_address: depositAddress
    }).returning('*');

    res.status(201).json({
      depositAddress,
      transactionId: transaction.id
    });
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new withdrawal request
const createWithdrawal: RequestHandler<{}, any, WithdrawalRequest> = async (req, res) => {
  try {
    const { amount, dogecoinAddress, userAddress } = req.body;

    // Validate amount
    const amountFloat = parseFloat(amount);
    if (amountFloat < 1.0) {
      res.status(400).json({ error: 'Amount below minimum withdrawal of 1 DOGE' });
      return;
    }

    // Validate addresses
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }

    // Validate Dogecoin address format (basic check)
    if (!dogecoinAddress.match(/^D[1-9A-HJ-NP-Za-km-z]{33}$/)) {
      res.status(400).json({ error: 'Invalid Dogecoin address format' });
      return;
    }

    // Check user balance
    const user = await db('users').where('address', userAddress).first();
    if (!user || user.balance < amountFloat) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    // Create withdrawal transaction
    const [transaction] = await db('transactions').insert({
      type: 'withdrawal',
      status: 'pending',
      amount: amountFloat,
      user_address: userAddress,
      dogecoin_address: dogecoinAddress
    }).returning('*');

    // Update user balance
    await db('users')
      .where('address', userAddress)
      .decrement('balance', amountFloat);

    res.status(201).json({
      withdrawalId: transaction.id
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get transaction status
const getTransaction: RequestHandler<TransactionParams> = async (req, res) => {
  try {
    const transaction = await db('transactions')
      .where('id', req.params.id)
      .first();

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      userAddress: transaction.user_address,
      dogecoinAddress: transaction.dogecoin_address,
      txid: transaction.txid,
      confirmations: transaction.confirmations,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at
    });
  } catch (error) {
    console.error('Error getting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user balance
const getUserBalance: RequestHandler<UserParams> = async (req, res) => {
  try {
    const user = await db('users')
      .where('address', req.params.address)
      .first();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      address: user.address,
      balance: user.balance.toString()
    });
  } catch (error) {
    console.error('Error getting user balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get staking info
const getStakingInfo: RequestHandler<UserParams> = async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const staking = WDOGEStaking__factory.connect(process.env.STAKING_CONTRACT_ADDRESS!, provider);
    
    const [stakedAmount, pendingRewards] = await staking.getStakeInfo(req.params.address);
    const rewardRate = await staking.rewardRate();
    
    res.json({
      stakedAmount: ethers.formatUnits(stakedAmount, 8),
      pendingRewards: ethers.formatUnits(pendingRewards, 8),
      apy: Number(rewardRate) / 100, // Convert basis points to percentage
      lockPeriod: 0,
      nextRewardAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Next day
    });
  } catch (error) {
    console.error('Error getting staking info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get loan info
const getLoanInfo: RequestHandler<UserParams> = async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const lending = WDOGELending__factory.connect(process.env.LENDING_CONTRACT_ADDRESS!, provider);
    
    const [loanAmount, collateralAmount, interestDue, collateralRatio] = await lending.getLoanInfo(req.params.address);
    
    res.json({
      loanAmount: ethers.formatUnits(loanAmount, 8),
      collateralAmount: ethers.formatUnits(collateralAmount, 8),
      interestDue: ethers.formatUnits(interestDue, 8),
      collateralRatio: Number(collateralRatio) / 100, // Convert basis points to percentage
      liquidationThreshold: 150 // 150% collateral ratio
    });
  } catch (error) {
    console.error('Error getting loan info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// List transactions
const listTransactions: RequestHandler<{}, any, {}, TransactionQuery> = async (req, res) => {
  try {
    const { address, status, from, to, limit = 10, offset = 0 } = req.query;
    
    let query = db('transactions')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 100)) // Max 100 records
      .offset(offset);
    
    if (address) {
      query = query.where('user_address', address);
    }
    
    if (status) {
      query = query.where('status', status);
    }
    
    if (from) {
      query = query.where('created_at', '>=', new Date(from));
    }
    
    if (to) {
      query = query.where('created_at', '<=', new Date(to));
    }
    
    const [transactions, total] = await Promise.all([
      query,
      db('transactions').count('* as count').first()
    ]);
    
    res.json({
      transactions: transactions.map(tx => ({
        txId: tx.id,
        type: tx.type,
        status: tx.status,
        amount: tx.amount.toString(),
        fee: tx.fee?.toString() || '0',
        timestamp: tx.created_at
      })),
      pagination: {
        total: total?.count || 0,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error listing transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Stake tokens
const stakeTokens: RequestHandler<{}, any, StakingRequest> = async (req, res) => {
  try {
    const { amount, userAddress } = req.body;
    
    // Validate amount
    const amountFloat = parseFloat(amount);
    if (amountFloat <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    
    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }
    
    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'stake',
      status: 'pending',
      amount: amountFloat,
      user_address: userAddress
    }).returning('*');
    
    res.status(201).json({
      transactionId: transaction.id,
      message: 'Stake request created successfully'
    });
  } catch (error) {
    console.error('Error staking tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unstake tokens
const unstakeTokens: RequestHandler<{}, any, StakingRequest> = async (req, res) => {
  try {
    const { amount, userAddress } = req.body;
    
    // Validate amount
    const amountFloat = parseFloat(amount);
    if (amountFloat <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    
    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }
    
    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'unstake',
      status: 'pending',
      amount: amountFloat,
      user_address: userAddress
    }).returning('*');
    
    res.status(201).json({
      transactionId: transaction.id,
      message: 'Unstake request created successfully'
    });
  } catch (error) {
    console.error('Error unstaking tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Claim rewards
const claimRewards: RequestHandler<UserParams> = async (req, res) => {
  try {
    const userAddress = req.params.address;
    
    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }
    
    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'claim_reward',
      status: 'pending',
      user_address: userAddress
    }).returning('*');
    
    res.status(201).json({
      transactionId: transaction.id,
      message: 'Claim request created successfully'
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Borrow tokens
const borrowTokens: RequestHandler<{}, any, LendingRequest> = async (req, res) => {
  try {
    const { amount, collateral, userAddress } = req.body;
    
    // Validate amounts
    const amountFloat = parseFloat(amount);
    const collateralFloat = parseFloat(collateral);
    if (amountFloat <= 0 || collateralFloat <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    
    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }
    
    // Check collateral ratio (minimum 150%)
    if (collateralFloat / amountFloat < 1.5) {
      res.status(400).json({ error: 'Insufficient collateral' });
      return;
    }
    
    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'borrow',
      status: 'pending',
      amount: amountFloat,
      collateral: collateralFloat,
      user_address: userAddress
    }).returning('*');
    
    res.status(201).json({
      transactionId: transaction.id,
      message: 'Borrow request created successfully'
    });
  } catch (error) {
    console.error('Error borrowing tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Repay loan
const repayLoan: RequestHandler<{}, any, LendingRequest> = async (req, res) => {
  try {
    const { amount, userAddress } = req.body;
    
    // Validate amount
    const amountFloat = parseFloat(amount);
    if (amountFloat <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    
    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }
    
    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'repay',
      status: 'pending',
      amount: amountFloat,
      user_address: userAddress
    }).returning('*');
    
    res.status(201).json({
      transactionId: transaction.id,
      message: 'Repay request created successfully'
    });
  } catch (error) {
    console.error('Error repaying loan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Liquidate loan
const liquidateLoan: RequestHandler<UserParams> = async (req, res) => {
  try {
    const userAddress = req.params.address;
    
    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      res.status(400).json({ error: 'Invalid Ethereum address' });
      return;
    }
    
    // Check if loan can be liquidated
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const lending = WDOGELending__factory.connect(process.env.LENDING_CONTRACT_ADDRESS!, provider);
    const [,,,collateralRatio] = await lending.getLoanInfo(userAddress);
    
    if (collateralRatio >= 15000) { // 150% in basis points
      res.status(400).json({ error: 'Loan not eligible for liquidation' });
      return;
    }
    
    // Create transaction record
    const [transaction] = await db('transactions').insert({
      type: 'liquidate',
      status: 'pending',
      user_address: userAddress
    }).returning('*');
    
    res.status(201).json({
      transactionId: transaction.id,
      message: 'Liquidation request created successfully'
    });
  } catch (error) {
    console.error('Error liquidating loan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Total Value Locked (TVL)
const getTVL: RequestHandler = async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const staking = WDOGEStaking__factory.connect(process.env.STAKING_CONTRACT_ADDRESS!, provider);
    const lending = WDOGELending__factory.connect(process.env.LENDING_CONTRACT_ADDRESS!, provider);
    
    const [totalStaked, totalLoaned, totalCollateral] = await Promise.all([
      staking.totalStaked(),
      lending.totalLoaned(),
      lending.totalCollateral()
    ]);

    const tvl = {
      staking: ethers.formatUnits(totalStaked, 8),
      lending: {
        borrowed: ethers.formatUnits(totalLoaned, 8),
        collateral: ethers.formatUnits(totalCollateral, 8)
      },
      total: ethers.formatUnits(totalStaked + totalLoaned + totalCollateral, 8)
    };

    res.status(200).json({ success: true, data: tvl });
  } catch (error) {
    console.error('Error getting TVL:', error);
    res.status(500).json({ success: false, error: 'Failed to get TVL' });
  }
};

// Get Trading Volume
const getVolume: RequestHandler = async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const now = new Date();
    let startTime: Date;
    
    switch (period) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // 24h
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const volumes = await db('transactions')
      .select(db.raw('type, SUM(amount) as total'))
      .where('created_at', '>=', startTime)
      .whereIn('type', ['deposit', 'withdrawal'])
      .groupBy('type');
    
    const volumeMap = volumes.reduce((acc, { type, total }) => {
      acc[type] = total.toString();
      return acc;
    }, {} as Record<string, string>);
    
    res.json({
      volume: {
        period,
        deposit: volumeMap.deposit || '0',
        withdrawal: volumeMap.withdrawal || '0',
        total: (Number(volumeMap.deposit || 0) + Number(volumeMap.withdrawal || 0)).toString()
      }
    });
  } catch (error) {
    console.error('Error getting volume:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get APY Statistics
const getAPY: RequestHandler = async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const staking = WDOGEStaking__factory.connect(process.env.STAKING_CONTRACT_ADDRESS!, provider);
    const lending = WDOGELending__factory.connect(process.env.LENDING_CONTRACT_ADDRESS!, provider);
    
    const [rewardRate] = await Promise.all([
      staking.rewardRate()
    ]);

    // Lending uses fixed interest rate of 5% (500 basis points)
    const LENDING_INTEREST_RATE = 500;
    const RATE_PRECISION = 10000;

    const apy = {
      staking: Number(rewardRate) / RATE_PRECISION * 100,
      lending: LENDING_INTEREST_RATE / RATE_PRECISION * 100
    };

    res.status(200).json({ success: true, data: apy });
  } catch (error) {
    console.error('Error getting APY:', error);
    res.status(500).json({ success: false, error: 'Failed to get APY' });
  }
};

// Get Transaction Statistics
const getTransactionStats: RequestHandler = async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const now = new Date();
    let startTime: Date;
    
    switch (period) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // 24h
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const [stats, avgConfirmationTime] = await Promise.all([
      db('transactions')
        .select(db.raw('type, status, COUNT(*) as count'))
        .where('created_at', '>=', startTime)
        .groupBy('type', 'status'),
      db('transactions')
        .select(db.raw('AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_time'))
        .where('status', 'completed')
        .where('created_at', '>=', startTime)
        .first()
    ]);
    
    const statsMap = stats.reduce((acc, { type, status, count }) => {
      if (!acc[type]) acc[type] = {};
      acc[type][status] = count;
      return acc;
    }, {} as Record<string, Record<string, number>>);
    
    res.json({
      stats: {
        period,
        transactions: statsMap,
        averageConfirmationTime: avgConfirmationTime?.avg_time || 0
      }
    });
  } catch (error) {
    console.error('Error getting transaction stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Pending Transactions
const getPendingTransactions: RequestHandler = async (req, res) => {
  try {
    const { type, limit = 10, offset = 0 } = req.query;
    
    let query = db('transactions')
      .select('*')
      .where('status', 'pending')
      .orderBy('created_at', 'asc')
      .limit(Math.min(Number(limit), 100))
      .offset(Number(offset));
    
    if (type) {
      query = query.where('type', type);
    }
    
    const [transactions, total] = await Promise.all([
      query,
      db('transactions')
        .where('status', 'pending')
        .count('* as count')
        .first()
    ]);
    
    res.json({
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        userAddress: tx.user_address,
        dogecoinAddress: tx.dogecoin_address,
        createdAt: tx.created_at,
        elapsedTime: Math.floor((Date.now() - new Date(tx.created_at).getTime()) / 1000)
      })),
      pagination: {
        total: total?.count || 0,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    console.error('Error getting pending transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Register routes
router.post('/deposits', createDeposit);
router.post('/withdrawals', createWithdrawal);
router.get('/transactions/:id', getTransaction);
router.get('/transactions', listTransactions);
router.get('/users/:address/balance', getUserBalance);
router.get('/staking/:address', getStakingInfo);
router.get('/lending/:address', getLoanInfo);

// Register staking routes
router.post('/staking/stake', stakeTokens);
router.post('/staking/unstake', unstakeTokens);
router.post('/staking/:address/claim', claimRewards);

// Register lending routes
router.post('/lending/borrow', borrowTokens);
router.post('/lending/repay', repayLoan);
router.post('/lending/:address/liquidate', liquidateLoan);

// Register analytics routes
router.get('/analytics/tvl', getTVL);
router.get('/analytics/volume', getVolume);
router.get('/analytics/apy', getAPY);

// Register transaction routes
router.get('/transactions/stats', getTransactionStats);
router.get('/transactions/pending', getPendingTransactions);

// Mount the router at /api/v1
app.use('/api/v1', router);

export { app }; 