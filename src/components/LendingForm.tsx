import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import { getLendingContract, getWDOGEContract, validateAmount, formatUnits, parseUnits } from '../utils/contracts';

interface LendingFormProps {
  account?: string;
  provider?: any;
}

interface LendingContract extends Contract {
  borrow: (amount: bigint, collateralAmount: bigint) => Promise<any>;
  repay: (amount: bigint) => Promise<any>;
  addCollateral: (amount: bigint) => Promise<any>;
  withdrawCollateral: (amount: bigint) => Promise<any>;
  getLoan: (borrower: string) => Promise<{
    amount: bigint;
    collateral: bigint;
    timestamp: bigint;
    interestPaid: bigint;
  }>;
  getCollateralRatio: (borrower: string) => Promise<bigint>;
  getInterestDue: (borrower: string) => Promise<bigint>;
}

interface WDOGEContract extends Contract {
  approve: (spender: string, amount: bigint) => Promise<any>;
  balanceOf: (account: string) => Promise<bigint>;
}

interface LendingInfo {
  borrowedAmount: string;
  collateralAmount: string;
  interestDue: string;
  collateralRatio: string;
  totalBorrowed: string;
  totalCollateral: string;
}

const LendingForm: React.FC<LendingFormProps> = ({ account, provider }) => {
  const [amount, setAmount] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'borrow' | 'repay'>('borrow');
  const [lendingInfo, setLendingInfo] = useState<LendingInfo>({
    borrowedAmount: '0',
    collateralAmount: '0',
    interestDue: '0',
    collateralRatio: '0',
    totalBorrowed: '0',
    totalCollateral: '0'
  });
  const [maxBorrowAmount, setMaxBorrowAmount] = useState('0');
  const [walletBalance, setWalletBalance] = useState('0');

  const handleError = (error: any) => {
    console.error('Error:', error);
    setError(error?.message || 'An error occurred');
    setIsLoading(false);
  };

  const updateLendingInfo = async () => {
    if (!provider || !account) {
      console.log('Provider or account not available');
      return;
    }

    try {
      const signer = await provider.getSigner();
      if (!signer) {
        console.log('Signer not available');
        return;
      }

      const { contract: lendingContract } = await getLendingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      
      if (!lendingContract || !wdogeContract) {
        console.log('Contracts not available');
        return;
      }

      const lending = lendingContract as unknown as LendingContract;
      const wdoge = wdogeContract as unknown as WDOGEContract;

      const [loan, collateralRatio, interestDue, balance] = await Promise.all([
        lending.getLoan(account),
        lending.getCollateralRatio(account),
        lending.getInterestDue(account),
        wdoge.balanceOf(account)
      ]);

      setLendingInfo({
        borrowedAmount: formatUnits(loan.amount),
        collateralAmount: formatUnits(loan.collateral),
        interestDue: formatUnits(interestDue),
        collateralRatio: formatUnits(collateralRatio),
        totalBorrowed: formatUnits(balance),
        totalCollateral: formatUnits(loan.collateral)
      });

      setWalletBalance(formatUnits(balance));
      setMaxBorrowAmount(formatUnits(balance));
    } catch (error) {
      console.error('Error updating lending info:', error);
      handleError(error);
    }
  };

  useEffect(() => {
    if (provider && account) {
      updateLendingInfo();
      const interval = setInterval(updateLendingInfo, 15000);
      return () => clearInterval(interval);
    }
  }, [provider, account]);

  const handleBorrow = async () => {
    if (!provider || !account || !validateAmount(amount) || !validateAmount(collateralAmount)) return;

    setIsLoading(true);
    setError('');

    try {
      const { contract: lendingContract, address: lendingAddress } = await getLendingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      const lending = lendingContract as unknown as LendingContract;
      const wdoge = wdogeContract as unknown as WDOGEContract;

      // Approve lending contract to spend wDOGE as collateral
      const approveTx = await wdoge.approve(lendingAddress, parseUnits(collateralAmount));
      await approveTx.wait();

      // Borrow wDOGE
      const borrowTx = await lending.borrow(parseUnits(amount), parseUnits(collateralAmount));
      await borrowTx.wait();

      setAmount('');
      setCollateralAmount('');
      await updateLendingInfo();
    } catch (error) {
      handleError(error);
    }
  };

  const handleRepay = async () => {
    if (!provider || !account || !validateAmount(amount)) return;

    setIsLoading(true);
    setError('');

    try {
      const { contract: lendingContract } = await getLendingContract(provider);
      const lending = lendingContract as unknown as LendingContract;

      const tx = await lending.repay(parseUnits(amount));
      await tx.wait();

      setAmount('');
      await updateLendingInfo();
    } catch (error) {
      handleError(error);
    }
  };

  const handleAddCollateral = async () => {
    if (!provider || !account || !validateAmount(collateralAmount)) return;

    setIsLoading(true);
    setError('');

    try {
      const { contract: lendingContract, address: lendingAddress } = await getLendingContract(provider);
      const { contract: wdogeContract } = await getWDOGEContract(provider);
      const lending = lendingContract as unknown as LendingContract;
      const wdoge = wdogeContract as unknown as WDOGEContract;

      // Approve lending contract to spend wDOGE
      const approveTx = await wdoge.approve(lendingAddress, parseUnits(collateralAmount));
      await approveTx.wait();

      // Add collateral
      const tx = await lending.addCollateral(parseUnits(collateralAmount));
      await tx.wait();

      setCollateralAmount('');
      await updateLendingInfo();
    } catch (error) {
      handleError(error);
    }
  };

  const handleWithdrawCollateral = async () => {
    if (!provider || !account || !validateAmount(collateralAmount)) return;

    setIsLoading(true);
    setError('');

    try {
      const { contract: lendingContract } = await getLendingContract(provider);
      const lending = lendingContract as unknown as LendingContract;

      const tx = await lending.withdrawCollateral(parseUnits(collateralAmount));
      await tx.wait();

      setCollateralAmount('');
      await updateLendingInfo();
    } catch (error) {
      handleError(error);
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
          <h3 className="text-sm font-medium text-gray-200 mb-4">Your Lending Info</h3>
          <dl className="mt-2 space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Borrowed Amount:</dt>
              <dd className="text-sm font-medium text-gray-200">{lendingInfo.borrowedAmount} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Collateral Amount:</dt>
              <dd className="text-sm font-medium text-gray-200">{lendingInfo.collateralAmount} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Interest Due:</dt>
              <dd className="text-sm font-medium text-orange-500">{lendingInfo.interestDue} wDOGE</dd>
            </div>
          </dl>
        </div>

        <div className="bg-[#1a1b1e] p-4 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium text-gray-200 mb-4">Pool Info</h3>
          <dl className="mt-2 space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Total Borrowed:</dt>
              <dd className="text-sm font-medium text-gray-200">{lendingInfo.totalBorrowed} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Total Collateral:</dt>
              <dd className="text-sm font-medium text-gray-200">{lendingInfo.totalCollateral} wDOGE</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-400">Collateral Ratio:</dt>
              <dd className="text-sm font-medium text-orange-500">{lendingInfo.collateralRatio}%</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-[#1a1b1e] p-6 rounded-lg border border-gray-800">
        <div className="space-y-4">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setActiveTab('borrow')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                activeTab === 'borrow'
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#2c2d30] text-gray-400 hover:bg-[#3c3d40] border border-gray-700'
              }`}
            >
              Borrow
            </button>
            <button
              onClick={() => setActiveTab('repay')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                activeTab === 'repay'
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#2c2d30] text-gray-400 hover:bg-[#3c3d40] border border-gray-700'
              }`}
            >
              Repay
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              {activeTab === 'borrow' ? 'Borrow Amount' : 'Repay Amount'} (wDOGE)
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
                onClick={() => setAmount(maxBorrowAmount)}
                className="ml-2 px-3 py-2 text-sm bg-[#2c2d30] text-orange-500 rounded hover:bg-[#3c3d40] border border-gray-700"
              >
                Max
              </button>
            </div>
          </div>

          {activeTab === 'borrow' && (
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Collateral Amount (wDOGE)
              </label>
              <div className="flex">
                <input
                  type="number"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  min="0"
                  step="0.00000001"
                  className="block w-full px-3 py-2 bg-[#2c2d30] border border-gray-700 rounded text-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  placeholder="Enter collateral amount"
                />
                <button
                  onClick={() => setCollateralAmount(walletBalance)}
                  className="ml-2 px-3 py-2 text-sm bg-[#2c2d30] text-orange-500 rounded hover:bg-[#3c3d40] border border-gray-700"
                >
                  Max
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900/50 text-red-400 rounded border border-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {activeTab === 'borrow' ? (
              <button
                onClick={handleBorrow}
                disabled={isLoading}
                className={`px-4 py-2 rounded text-white font-medium ${
                  isLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {isLoading ? 'Processing...' : 'Borrow'}
              </button>
            ) : (
              <button
                onClick={handleRepay}
                disabled={isLoading}
                className={`px-4 py-2 rounded text-white font-medium ${
                  isLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {isLoading ? 'Processing...' : 'Repay'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={handleAddCollateral}
              disabled={isLoading}
              className={`px-4 py-2 rounded text-white font-medium ${
                isLoading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-[#2c2d30] hover:bg-[#3c3d40] border border-gray-700'
              }`}
            >
              {isLoading ? 'Processing...' : 'Add Collateral'}
            </button>

            <button
              onClick={handleWithdrawCollateral}
              disabled={isLoading}
              className={`px-4 py-2 rounded text-white font-medium ${
                isLoading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-[#2c2d30] hover:bg-[#3c3d40] border border-gray-700'
              }`}
            >
              {isLoading ? 'Processing...' : 'Withdraw Collateral'}
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            Note: Minimum collateral ratio is 150%
          </div>
        </div>
      </div>
    </div>
  );
};

export default LendingForm; 