import { useState, useEffect } from 'react';
import { ethers, Contract, BrowserProvider, BaseContract } from 'ethers';
import { getStakingContract, getWDOGEContract, validateAmount, formatUnits, parseUnits } from '../utils/contracts';

interface StakingFormProps {
  account: string;
  provider?: BrowserProvider;
}

interface StakingContract extends BaseContract {
  stake(amount: bigint): Promise<any>;
  unstake(amount: bigint): Promise<any>;
  getRewards(account: string): Promise<bigint>;
  rewardRate(): Promise<bigint>;
  totalStaked(): Promise<bigint>;
  claimRewards(): Promise<any>;
  balanceOf(account: string): Promise<bigint>;
}

interface WDOGEContract extends BaseContract {
  approve(spender: string, amount: bigint): Promise<any>;
  balanceOf(account: string): Promise<bigint>;
}

const StakingForm: React.FC<StakingFormProps> = ({ account, provider }) => {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stakingInfo, setStakingInfo] = useState({
    stakedBalance: '0',
    pendingRewards: '0',
    apy: '0',
    totalStaked: '0',
    walletBalance: '0',
  });

  useEffect(() => {
    const fetchStakingInfo = async () => {
      if (!provider || !account) return;

      try {
        const { contract: stakingContract } = await getStakingContract(provider);
        const { contract: wdogeContract } = await getWDOGEContract(provider);
        const staking = stakingContract as unknown as StakingContract;
        const wdoge = wdogeContract as unknown as WDOGEContract;

        const [stakedBalance, pendingRewards, rewardRate, totalStaked, walletBalance] = await Promise.all([
          staking.balanceOf(account),
          staking.getRewards(account),
          staking.rewardRate(),
          staking.totalStaked(),
          wdoge.balanceOf(account),
        ]);

        // Calculate APY: (rewardRate * 365 days * 100) / totalStaked
        const apy = totalStaked > 0n
          ? (rewardRate * 365n * 100n * 10000n) / totalStaked
          : 0n;

        setStakingInfo({
          stakedBalance: formatUnits(stakedBalance),
          pendingRewards: formatUnits(pendingRewards),
          apy: (Number(apy) / 100).toFixed(2),
          totalStaked: formatUnits(totalStaked),
          walletBalance: formatUnits(walletBalance),
        });
      } catch (error) {
        console.error('Error fetching staking info:', error);
        setError('Failed to fetch staking information');
      }
    };

    fetchStakingInfo();
    const interval = setInterval(fetchStakingInfo, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, [provider, account]);

  const handleStake = async () => {
    if (!provider || !account || !validateAmount(amount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: stakingContract, address: stakingAddress } = await getStakingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      const staking = stakingContract as unknown as StakingContract;
      const wdoge = wdogeContract as unknown as WDOGEContract;

      // Approve staking contract to spend wDOGE
      const approveTx = await wdoge.approve(stakingAddress, parseUnits(amount));
      await approveTx.wait();

      // Stake wDOGE
      const stakeTx = await staking.stake(parseUnits(amount));
      await stakeTx.wait();

      setAmount('');
    } catch (error) {
      console.error('Error staking:', error);
      setError('Failed to stake tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!provider || !account || !validateAmount(amount)) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: stakingContract } = await getStakingContract(provider);
      const staking = stakingContract as unknown as StakingContract;

      const tx = await staking.unstake(parseUnits(amount));
      await tx.wait();

      setAmount('');
    } catch (error) {
      console.error('Error unstaking:', error);
      setError('Failed to unstake tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!provider || !account) return;

    setIsLoading(true);
    setError(null);

    try {
      const { contract: stakingContract } = await getStakingContract(provider);
      const staking = stakingContract as unknown as StakingContract;

      const tx = await staking.claimRewards();
      await tx.wait();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      setError('Failed to claim rewards');
    } finally {
      setIsLoading(false);
    }
  };

  if (!provider) {
    return (
      <div className="text-center text-gray-400">
        Please connect your wallet to continue
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="bg-[#1a1b1e] p-4 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium text-gray-200 mb-4">Your Staking Info</h3>
          <dl className="mt-2 space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Staked Balance:</dt>
              <dd className="text-sm font-medium text-gray-200">{stakingInfo.stakedBalance} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Wallet Balance:</dt>
              <dd className="text-sm font-medium text-gray-200">{stakingInfo.walletBalance} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Pending Rewards:</dt>
              <dd className="text-sm font-medium text-orange-500">{stakingInfo.pendingRewards} wDOGE</dd>
            </div>
          </dl>
        </div>

        <div className="bg-[#1a1b1e] p-4 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium text-gray-200 mb-4">Pool Info</h3>
          <dl className="mt-2 space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Total Staked:</dt>
              <dd className="text-sm font-medium text-gray-200">{stakingInfo.totalStaked} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">APY:</dt>
              <dd className="text-sm font-medium text-orange-500">{stakingInfo.apy}%</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-[#1a1b1e] p-6 rounded-lg border border-gray-800">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Amount (wDOGE)
            </label>
            <div className="flex">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.00000001"
                className="block w-full px-3 py-2 bg-[#2c2d30] border border-gray-700 rounded text-gray-200 focus:border-orange-500 focus:ring-orange-500"
                placeholder="Enter amount"
              />
              <button
                onClick={() => setAmount(stakingInfo.walletBalance)}
                className="ml-2 px-3 py-2 text-sm bg-[#2c2d30] text-orange-500 rounded hover:bg-[#3c3d40] border border-gray-700"
              >
                Max
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 text-red-400 rounded border border-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={handleStake}
              disabled={isLoading}
              className={`px-4 py-2 rounded text-white font-medium ${
                isLoading 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {isLoading ? 'Processing...' : 'Stake'}
            </button>

            <button
              onClick={handleUnstake}
              disabled={isLoading}
              className={`px-4 py-2 rounded text-white font-medium ${
                isLoading 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-[#2c2d30] hover:bg-[#3c3d40] border border-gray-700'
              }`}
            >
              {isLoading ? 'Processing...' : 'Unstake'}
            </button>

            <button
              onClick={handleClaimRewards}
              disabled={isLoading || Number(stakingInfo.pendingRewards) === 0}
              className={`px-4 py-2 rounded text-white font-medium ${
                isLoading || Number(stakingInfo.pendingRewards) === 0
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {isLoading ? 'Processing...' : 'Claim Rewards'}
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            Note: Staked tokens have a 7-day lock period
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakingForm; 