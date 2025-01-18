import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

type BrowserProvider = InstanceType<typeof ethers.BrowserProvider>;

interface Web3ContextType {
  account: string;
  provider: BrowserProvider | undefined;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

const POLYGON_CHAIN_ID = process.env.NEXT_PUBLIC_NETWORK === 'localhost' ? '0x539' : '0x89'; // 1337 or 137 in hex
const POLYGON_PARAMS = process.env.NEXT_PUBLIC_NETWORK === 'localhost' ? {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Hardhat Local',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['http://127.0.0.1:8545'],
  blockExplorerUrls: []
} : {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18
  },
  rpcUrls: ['https://polygon-rpc.com/'],
  blockExplorerUrls: ['https://polygonscan.com/']
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
      selectedAddress?: string | null;
    };
  }
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  const checkMetaMask = () => {
    const { ethereum } = window;
    if (!ethereum) {
      throw new Error('Please install MetaMask to use this application');
    }
    if (!ethereum.isMetaMask) {
      throw new Error('Please use MetaMask as your wallet provider');
    }
    return ethereum;
  };

  const checkChainId = async (ethereum: Window['ethereum']) => {
    if (!ethereum) return false;
    try {
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      return chainId === POLYGON_CHAIN_ID;
    } catch (error) {
      console.error('Error checking chain ID:', error);
      return false;
    }
  };

  const switchToPolygon = async () => {
    const ethereum = checkMetaMask();

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_CHAIN_ID }],
      });
      setIsCorrectChain(true);
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [POLYGON_PARAMS],
          });
          setIsCorrectChain(true);
        } catch (addError) {
          console.error('Error adding Polygon network:', addError);
          setIsCorrectChain(false);
          throw new Error('Failed to add Polygon network');
        }
      } else {
        console.error('Error switching to Polygon network:', switchError);
        setIsCorrectChain(false);
        throw new Error('Failed to switch to Polygon network');
      }
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const ethereum = checkMetaMask();

      // First try to get the currently selected address
      let accounts: string[] = [];
      if (ethereum.selectedAddress) {
        accounts = [ethereum.selectedAddress];
      } else {
        try {
          // Try to get accounts that have already given permission
          accounts = await ethereum.request({ method: 'eth_accounts' });
        } catch (error) {
          console.warn('Error checking existing accounts:', error);
        }

        // If no accounts found, request permission
        if (!accounts || accounts.length === 0) {
          accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        }
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found or user denied access');
      }

      await switchToPolygon();
      const provider = new ethers.BrowserProvider(ethereum);
      
      setAccount(accounts[0]);
      setProvider(provider);
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setProvider(undefined);
    setError(null);
    setIsCorrectChain(false);
    // Clear any stored connection data if you have any
    localStorage.removeItem('walletConnected');
  };

  useEffect(() => {
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        try {
          await switchToPolygon();
        } catch (error) {
          console.error('Error switching network:', error);
        }
      } else {
        setAccount('');
        setProvider(undefined);
      }
    };

    const handleChainChanged = async (chainId: string) => {
      if (chainId !== POLYGON_CHAIN_ID) {
        setIsCorrectChain(false);
        setError('Please switch to the correct network');
      } else {
        setIsCorrectChain(true);
        setError(null);
        const ethereum = window.ethereum;
        if (ethereum) {
          setProvider(new ethers.BrowserProvider(ethereum));
        }
      }
    };

    const setupInitialConnection = async () => {
      try {
        const ethereum = window.ethereum;
        if (ethereum?.selectedAddress) {
          await handleAccountsChanged([ethereum.selectedAddress]);
          const isCorrect = await checkChainId(ethereum);
          setIsCorrectChain(isCorrect);
          if (isCorrect) {
            setProvider(new ethers.BrowserProvider(ethereum));
          }
        }
      } catch (error) {
        console.error('Error setting up initial connection:', error);
      }
    };

    const ethereum = window.ethereum;
    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
      setupInitialConnection();

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const value = {
    account,
    provider,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
} 