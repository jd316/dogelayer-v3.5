import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LendingForm from '../../src/components/LendingForm';
import { ethers } from 'ethers';

describe('LendingForm', () => {
  const mockAccount = '0x123';
  const mockProvider = {
    getSigner: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(mockAccount)
    })
  } as unknown as typeof ethers.BrowserProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders lending form inputs and buttons', () => {
    render(<LendingForm account={mockAccount} provider={mockProvider} />);
    
    expect(screen.getByPlaceholderText('Loan amount')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Collateral amount')).toBeInTheDocument();
    expect(screen.getByText('Create Loan')).toBeInTheDocument();
    expect(screen.getByText('Repay Loan')).toBeInTheDocument();
  });

  it('handles loan creation', async () => {
    render(<LendingForm account={mockAccount} provider={mockProvider} />);
    
    const loanInput = screen.getByPlaceholderText('Loan amount');
    const collateralInput = screen.getByPlaceholderText('Collateral amount');
    const createButton = screen.getByText('Create Loan');

    fireEvent.change(loanInput, { target: { value: '1000' } });
    fireEvent.change(collateralInput, { target: { value: '2000' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Creating loan.../)).toBeInTheDocument();
    });
  });

  it('handles loan repayment', async () => {
    render(<LendingForm account={mockAccount} provider={mockProvider} />);
    
    const repayInput = screen.getByPlaceholderText('Repayment amount');
    const repayButton = screen.getByText('Repay Loan');

    fireEvent.change(repayInput, { target: { value: '1100' } });
    fireEvent.click(repayButton);

    await waitFor(() => {
      expect(screen.getByText(/Repaying loan.../)).toBeInTheDocument();
    });
  });
}); 