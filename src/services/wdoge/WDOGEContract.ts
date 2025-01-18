import { Contract, ContractTransactionResponse, BigNumberish, Provider, Signer, formatUnits, parseUnits } from 'ethers';

const WDOGE_ABI = [
    "function mint(address to, uint256 amount) external",
    "function burn(uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Mint(address indexed to, uint256 value)",
    "event Burn(address indexed from, uint256 value)"
];

export class WDOGEContract {
    private contract: Contract;

    constructor(
        contractAddress: string,
        private readonly provider: Provider,
        private readonly signer: Signer
    ) {
        this.contract = new Contract(contractAddress, WDOGE_ABI, signer);
    }

    public async mint(userAddress: string, amountInSatoshis: number): Promise<ContractTransactionResponse> {
        // Convert Dogecoin satoshis to WDOGE (assuming 1:1 ratio)
        const amount = parseUnits(amountInSatoshis.toString(), 8);
        return await this.contract.mint(userAddress, amount);
    }

    public async burn(amountInSatoshis: number): Promise<ContractTransactionResponse> {
        const amount = parseUnits(amountInSatoshis.toString(), 8);
        return await this.contract.burn(amount);
    }

    public async balanceOf(address: string): Promise<number> {
        const balance = await this.contract.balanceOf(address);
        return Number(formatUnits(balance, 8));
    }

    public async totalSupply(): Promise<number> {
        const supply = await this.contract.totalSupply();
        return Number(formatUnits(supply, 8));
    }

    public onMint(callback: (to: string, amount: number) => void): void {
        this.contract.on("Mint", (to: string, value: BigNumberish) => {
            const amount = Number(formatUnits(value, 8));
            callback(to, amount);
        });
    }

    public onBurn(callback: (from: string, amount: number) => void): void {
        this.contract.on("Burn", (from: string, value: BigNumberish) => {
            const amount = Number(formatUnits(value, 8));
            callback(from, amount);
        });
    }

    public onTransfer(callback: (from: string, to: string, amount: number) => void): void {
        this.contract.on("Transfer", (from: string, to: string, value: BigNumberish) => {
            const amount = Number(formatUnits(value, 8));
            callback(from, to, amount);
        });
    }
} 