import { ethers } from 'ethers';
import type { Provider, JsonRpcProvider } from 'ethers';
import { formatUnits as formatEthUnits, parseUnits as parseEthUnits } from '@ethersproject/units';
import WDOGE_ABI from '../abis/WDOGE.json';
import BRIDGE_ABI from '../abis/DogeBridge.json';
import STAKING_ABI from '../abis/WDOGEStaking.json';
import LENDING_ABI from '../abis/WDOGELending.json';
import { logger } from './logger';

class ContractError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ContractError';
  }
}

export const getWDOGEContract = async (provider: Provider | JsonRpcProvider) => {
  if (!provider) {
    throw new ContractError('Provider is required');
  }

  try {
    const address = process.env.NEXT_PUBLIC_WDOGE_ADDRESS;
    if (!address) {
      throw new ContractError('WDOGE contract address not found');
    }

    const contract = new ethers.Contract(address, WDOGE_ABI, provider);
    return { contract, address };
  } catch (error) {
    logger.error('Error getting WDOGE contract:', error instanceof Error ? error : new Error(String(error)));
    throw error instanceof ContractError ? error : new ContractError('Failed to get WDOGE contract');
  }
};

export const getBridgeContract = async (provider: Provider) => {
  if (!provider) {
    throw new ContractError('Provider is required');
  }

  try {
    const address = process.env.NEXT_PUBLIC_BRIDGE_ADDRESS;
    if (!address) {
      throw new ContractError('Bridge contract address not found');
    }

    const contract = new ethers.Contract(address, BRIDGE_ABI, provider);
    return { contract, address };
  } catch (error) {
    logger.error('Error getting Bridge contract:', error instanceof Error ? error : new Error(String(error)));
    throw error instanceof ContractError ? error : new ContractError('Failed to get Bridge contract');
  }
};

export const getStakingContract = async (provider: Provider) => {
  if (!provider) {
    throw new ContractError('Provider is required');
  }

  try {
    const address = process.env.NEXT_PUBLIC_STAKING_ADDRESS;
    if (!address) {
      throw new ContractError('Staking contract address not found');
    }

    const contract = new ethers.Contract(address, STAKING_ABI, provider);
    return { contract, address };
  } catch (error) {
    logger.error('Error getting Staking contract:', error instanceof Error ? error : new Error(String(error)));
    throw error instanceof ContractError ? error : new ContractError('Failed to get Staking contract');
  }
};

export const getLendingContract = async (provider: Provider) => {
  if (!provider) {
    throw new ContractError('Provider is required');
  }

  try {
    const address = process.env.NEXT_PUBLIC_LENDING_ADDRESS;
    if (!address) {
      throw new ContractError('Lending contract address not found');
    }

    const contract = new ethers.Contract(address, LENDING_ABI, provider);
    return { contract, address };
  } catch (error) {
    logger.error('Error getting Lending contract:', error instanceof Error ? error : new Error(String(error)));
    throw error instanceof ContractError ? error : new ContractError('Failed to get Lending contract');
  }
};

export const validateAmount = (amount: string): boolean => {
  if (!amount) return false;
  const num = Number(amount);
  return !isNaN(num) && num > 0;
};

export const formatUnits = (value: string | number | bigint, decimals: number = 18): string => {
  try {
    return formatEthUnits(value.toString(), decimals);
  } catch (error) {
    logger.error('Error formatting units:', error instanceof Error ? error : new Error(String(error)));
    return '0';
  }
};

export const parseUnits = (value: string, decimals: number = 18): bigint => {
  try {
    return BigInt(parseEthUnits(value, decimals).toString());
  } catch (error) {
    logger.error('Error parsing units:', error instanceof Error ? error : new Error(String(error)));
    return 0n;
  }
}; 