import React, { useEffect, useState } from 'react';
import { DogeBridge } from '../services/bridge/DogeBridge';

interface WithdrawalStatusProps {
    bridge: DogeBridge;
    withdrawalId: string;
}

interface WithdrawalState {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    txHash?: string;
    error?: string;
}

export const WithdrawalStatus: React.FC<WithdrawalStatusProps> = ({ bridge, withdrawalId }) => {
    const [status, setStatus] = useState<WithdrawalState>({
        status: 'pending'
    });

    useEffect(() => {
        const handleWithdrawalProcessed = (data: any) => {
            if (data.withdrawalId === withdrawalId) {
                setStatus({
                    status: 'completed',
                    txHash: data.txHash
                });
            }
        };

        const handleWithdrawalFailed = (data: any) => {
            if (data.withdrawalId === withdrawalId) {
                setStatus({
                    status: 'failed',
                    error: data.error
                });
            }
        };

        bridge.on('withdrawal_processed', handleWithdrawalProcessed);
        bridge.on('withdrawal_failed', handleWithdrawalFailed);

        return () => {
            bridge.off('withdrawal_processed', handleWithdrawalProcessed);
            bridge.off('withdrawal_failed', handleWithdrawalFailed);
        };
    }, [bridge, withdrawalId]);

    return (
        <div className="withdrawal-status">
            <h3>Withdrawal Status</h3>
            <div className="status-container">
                <p>Status: {status.status}</p>
                {status.txHash && (
                    <p>
                        Transaction Hash:{' '}
                        <a
                            href={`https://dogechain.info/tx/${status.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {status.txHash}
                        </a>
                    </p>
                )}
                {status.error && <p className="error">Error: {status.error}</p>}
            </div>
            <style jsx>{`
                .withdrawal-status {
                    padding: 1rem;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    margin: 1rem 0;
                }
                .status-container {
                    margin-top: 1rem;
                }
                .error {
                    color: red;
                }
            `}</style>
        </div>
    );
}; 