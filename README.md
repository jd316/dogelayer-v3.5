# Dogecoin to wDOGE Bridge on Polygon

A decentralized bridge for wrapping Dogecoin (DOGE) to Wrapped Dogecoin (wDOGE) on Polygon, with additional DeFi features including staking and lending.

## Features

- **Bridge**: Secure bridging between Dogecoin and Polygon networks
- **Staking**: Earn rewards by staking wDOGE tokens
- **Lending**: Borrow against your wDOGE collateral
- **User-friendly Interface**: Modern UI with real-time updates
- **Security**: Multi-signature validation and pausable contracts

## Prerequisites

- Node.js v16+
- Yarn or npm
- MetaMask wallet
- Dogecoin wallet
- Polygon RPC access (Alchemy/Infura)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/dogelayer-bridge.git
cd dogelayer-bridge
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```
POLYGON_RPC_URL=your_polygon_rpc_url
POLYGON_CHAIN_ID=137
DOGE_PRIVATE_KEY=your_dogecoin_private_key
DOGE_NETWORK=mainnet
MIN_CONFIRMATIONS=6
ADMIN_PRIVATE_KEY=your_polygon_private_key
```

## Development

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Deployment

1. Deploy contracts to Polygon:

```bash
npm run deploy:polygon
```

2. Start the bridge monitor:

```bash
npm run bridge:start
```

3. Start the Dogecoin transaction monitor:

```bash
npm run doge:monitor
```

## Contract Addresses

Polygon Mainnet:

- WDOGE: [Contract Address]
- Bridge: [Contract Address]
- Staking: [Contract Address]
- Lending: [Contract Address]

## Architecture

### Smart Contracts

1. **WDOGE.sol**
   - ERC20 token representing wrapped DOGE
   - Minting/burning controlled by bridge
   - Pausable for emergency situations

2. **DogeBridge.sol**
   - Handles cross-chain transactions
   - Multi-signature validation
   - Deposit/withdrawal processing

3. **WDOGEStaking.sol**
   - Staking mechanism with rewards
   - Configurable APY
   - Reward distribution system

4. **WDOGELending.sol**
   - Collateralized lending
   - Liquidation mechanism
   - Interest rate management

### Backend Services

1. **Bridge Monitor**
   - Validates cross-chain transactions
   - Processes deposits and withdrawals
   - Maintains transaction status

2. **Dogecoin Monitor**
   - Monitors Dogecoin blockchain
   - Verifies transactions
   - Generates deposit addresses

## Security

- Multi-signature validation for bridge operations
- Pausable contracts for emergency situations
- Rate limiting on deposits/withdrawals
- Minimum confirmation requirements
- Regular security audits

## API Documentation

### Bridge API

#### Generate Deposit Address

```typescript
POST /api/generateDepositAddress
Body: { amount: string, account: string }
Response: { depositAddress: string }
```

#### Check Transaction Status

```typescript
GET /api/transactionStatus/:txId
Response: { status: 'pending' | 'confirmed' | 'completed' | 'failed' }
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Testing

The project includes comprehensive tests:

- Unit tests for smart contracts
- Integration tests for API endpoints
- End-to-end tests for user flows

Run tests:

```bash
npm test                 # Run all tests
npm run test:contracts   # Run contract tests
npm run test:api        # Run API tests
```

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue in the GitHub repository or contact the team at [contact@email.com]
