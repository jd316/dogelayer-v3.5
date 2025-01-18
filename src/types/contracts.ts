import { Contract } from 'ethers';

export interface WDOGE extends Contract {
  mint(to: string, amount: bigint): Promise<any>;
  burn(from: string, amount: bigint): Promise<any>;
  balanceOf(account: string): Promise<bigint>;
  setBridge(bridge: string): Promise<any>;
  approve(spender: string, amount: bigint): Promise<any>;
}

export interface DogeBridge extends Contract {
  processedDeposits(depositId: string): Promise<boolean>;
  processedWithdrawals(withdrawalId: string): Promise<boolean>;
  processDeposit(
    recipient: string,
    amount: bigint,
    depositId: string,
    signature: string
  ): Promise<any>;
  requestWithdrawal(dogeAddress: string, amount: bigint): Promise<any>;
  updateLimits(
    minDeposit: bigint,
    maxDeposit: bigint,
    bridgeFee: bigint
  ): Promise<any>;
  pause(): Promise<any>;
  unpause(): Promise<any>;
} 