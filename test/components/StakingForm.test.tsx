import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StakingForm from '../../src/components/StakingForm';
import { ethers } from 'ethers';

describe('StakingForm', () => {
  const mockAccount = '0x123';
  const mockProvider = {
    getSigner: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(mockAccount)
    })
  } as unknown as typeof ethers.BrowserProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders stake input and buttons', () => {
    render(<StakingForm account={mockAccount} provider={mockProvider} />);
    
    expect(screen.getByPlaceholderText('Amount to stake')).toBeInTheDocument();
    expect(screen.getByText('Stake')).toBeInTheDocument();
    expect(screen.getByText('Unstake')).toBeInTheDocument();
  });

  it('handles stake action', async () => {
    render(<StakingForm account={mockAccount} provider={mockProvider} />);
    
    const input = screen.getByPlaceholderText('Amount to stake');
    const stakeButton = screen.getByText('Stake');

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(stakeButton);

    await waitFor(() => {
      expect(screen.getByText(/Staking.../)).toBeInTheDocument();
    });
  });

  it('handles unstake action', async () => {
    render(<StakingForm account={mockAccount} provider={mockProvider} />);
    
    const input = screen.getByPlaceholderText('Amount to stake');
    const unstakeButton = screen.getByText('Unstake');

    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.click(unstakeButton);

    await waitFor(() => {
      expect(screen.getByText(/Unstaking.../)).toBeInTheDocument();
    });
  });
}); 