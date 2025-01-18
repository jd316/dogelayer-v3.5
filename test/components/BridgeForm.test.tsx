import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BridgeForm from '../../src/components/BridgeForm';
import { ethers } from 'ethers';

describe('BridgeForm', () => {
  const mockAccount = '0x123';
  const mockProvider = {
    getSigner: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(mockAccount)
    })
  } as unknown as typeof ethers.BrowserProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders bridge form inputs and buttons', () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    expect(screen.getByPlaceholderText('Amount to bridge')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Dogecoin address')).toBeInTheDocument();
    expect(screen.getByText('Bridge to WDOGE')).toBeInTheDocument();
    expect(screen.getByText('Bridge to DOGE')).toBeInTheDocument();
  });

  it('handles bridging to WDOGE', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="deposit" />);
    
    const amountInput = screen.getByPlaceholderText('Amount to bridge');
    const bridgeButton = screen.getByText('Bridge to WDOGE');

    fireEvent.change(amountInput, { target: { value: '1000' } });
    fireEvent.click(bridgeButton);

    await waitFor(() => {
      expect(screen.getByText(/Bridging to WDOGE.../)).toBeInTheDocument();
    });
  });

  it('handles bridging to DOGE', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="withdraw" />);
    
    const amountInput = screen.getByPlaceholderText('Amount to bridge');
    const addressInput = screen.getByPlaceholderText('Dogecoin address');
    const bridgeButton = screen.getByText('Bridge to DOGE');

    fireEvent.change(amountInput, { target: { value: '1000' } });
    fireEvent.change(addressInput, { target: { value: 'DFabcd123...' } });
    fireEvent.click(bridgeButton);

    await waitFor(() => {
      expect(screen.getByText(/Bridging to DOGE.../)).toBeInTheDocument();
    });
  });

  it('validates Dogecoin address format', async () => {
    render(<BridgeForm account={mockAccount} provider={mockProvider} type="withdraw" />);
    
    const addressInput = screen.getByPlaceholderText('Dogecoin address');
    fireEvent.change(addressInput, { target: { value: 'invalid-address' } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid Dogecoin address/)).toBeInTheDocument();
    });
  });
}); 