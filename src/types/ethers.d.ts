declare module 'ethers' {
  export interface ContractRunner {
    provider?: Provider;
    signer?: Signer;
  }

  export interface Provider {
    getNetwork(): Promise<any>;
    getBlockNumber(): Promise<number>;
    getBalance(address: string): Promise<bigint>;
  }

  export interface Signer extends ContractRunner {
    getAddress(): Promise<string>;
    signMessage(message: string | Uint8Array): Promise<string>;
  }

  export interface Contract {
    address: string;
    interface: Interface;
    runner: ContractRunner;
    connect(runner: ContractRunner): Contract;
    getFunction(name: string): ContractFunction;
    balanceOf(account: string): Promise<bigint>;
  }

  export interface ContractFunction {
    (...args: Array<any>): Promise<any>;
  }

  export interface Interface {
    format(format?: string): string | string[];
    getFunction(name: string): ContractFunction;
  }

  export class BrowserProvider implements Provider {
    constructor(ethereum: any);
    getSigner(): Promise<JsonRpcSigner>;
    send(method: string, params: any[]): Promise<any>;
    getNetwork(): Promise<any>;
    getBlockNumber(): Promise<number>;
    getBalance(address: string): Promise<bigint>;
  }

  export class JsonRpcProvider extends BrowserProvider {
    constructor(url: string);
  }

  export class JsonRpcSigner implements Signer {
    provider: Provider;
    getAddress(): Promise<string>;
    signMessage(message: string | Uint8Array): Promise<string>;
  }

  export const Contract: {
    new (address: string, abi: any[], runnerOrProvider: ContractRunner | Provider): Contract;
  };

  export namespace ethers {
    export const Contract: typeof Contract;
    export const BrowserProvider: typeof BrowserProvider;
    export const JsonRpcProvider: typeof JsonRpcProvider;
    export const JsonRpcSigner: typeof JsonRpcSigner;
    export const getAddress: typeof getAddress;
    export const isAddress: typeof isAddress;
    export const id: typeof id;
    export const parseEther: typeof parseEther;
    export const formatEther: typeof formatEther;
    export const randomBytes: typeof randomBytes;
    export const hexlify: typeof hexlify;
    export const utils: {
      parseEther: typeof parseEther;
      formatEther: typeof formatEther;
      randomBytes: typeof randomBytes;
      hexlify: typeof hexlify;
    };
  }

  export function getAddress(address: string): string;
  export function isAddress(address: string): boolean;
  export function id(text: string): string;
  export function parseEther(value: string): bigint;
  export function formatEther(value: bigint): string;
  export function randomBytes(length: number): Uint8Array;
  export function hexlify(value: any): string;
} 