// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock window.ethereum
const ethereum = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  isMetaMask: true,
};

Object.defineProperty(window, 'ethereum', {
  value: ethereum,
});

// Mock process.env
process.env = {
  ...process.env,
  NEXT_PUBLIC_WDOGE_ADDRESS: '0x1234567890123456789012345678901234567890',
  NEXT_PUBLIC_BRIDGE_ADDRESS: '0x0987654321098765432109876543210987654321',
}; 