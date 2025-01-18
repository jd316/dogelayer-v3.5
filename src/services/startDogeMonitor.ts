import { config } from 'dotenv';
import { DogeMonitor } from '../services/dogeMonitor';
import { DogecoinP2WPKH } from './dogecoin/scripts/p2wpkh';

// Load environment variables
config();

async function main() {
  const {
    MIN_CONFIRMATIONS,
  } = process.env;

  // Generate a new key pair
  const dogecoin = new DogecoinP2WPKH();
  console.log('Generated deposit address:', dogecoin.generateAddress());

  const minConfirmations = MIN_CONFIRMATIONS ? parseInt(MIN_CONFIRMATIONS) : 6;

  // Initialize Dogecoin monitor with the generated key pair
  const monitor = new DogeMonitor(dogecoin, minConfirmations);
  console.log('Starting Dogecoin transaction monitoring service...');

  // Start monitoring with 1-minute intervals
  setInterval(() => {
    monitor.monitorTransactions().catch((error) => {
      console.error('Error in monitoring cycle:', error);
    });
  }, 60000);

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('Shutting down Dogecoin monitoring service...');
    process.exit();
  });
}

main().catch((error) => {
  console.error('Error starting Dogecoin monitor:', error);
  process.exit(1);
}); 