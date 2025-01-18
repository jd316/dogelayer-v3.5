import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { GasRelayerService } from '../../../services/gasRelayer/GasRelayerService';
import { AlertManager } from '../../../services/monitoring/AlertManager';
import { GasRelayer } from '../../../../typechain-types/contracts/GasRelayer';
import { withRateLimit } from '../../../middleware/rateLimit';

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const gasRelayerAddress = process.env.GAS_RELAYER_CONTRACT_ADDRESS;
const alertManager = new AlertManager(process.env.ALERT_WEBHOOK_URL || '');

// Initialize contract
const gasRelayerContract = new ethers.Contract(
    gasRelayerAddress || '',
    require('../../../../artifacts/contracts/GasRelayer.sol/GasRelayer.json').abi,
    provider
) as unknown as GasRelayer;

const gasRelayerService = new GasRelayerService(
    gasRelayerContract,
    alertManager,
    provider,
    Number(process.env.GAS_PRICE_UPDATE_INTERVAL),
    ethers.parseUnits(process.env.MAX_GAS_PRICE || "500", "gwei")
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Validate contract address
    if (!gasRelayerAddress || !ethers.isAddress(gasRelayerAddress)) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'CONTRACT_NOT_CONFIGURED',
                message: 'Gas relayer contract address not properly configured'
            }
        });
    }

    if (req.method === 'GET') {
        switch(req.query.action) {
            case 'estimate':
                return handleEstimate(req, res);
            case 'balance':
                return handleBalance(req, res);
            default:
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_ACTION',
                        message: 'Invalid action specified'
                    }
                });
        }
    } else if (req.method === 'POST') {
        switch(req.query.action) {
            case 'compensate':
                return handleCompensate(req, res);
            case 'withdraw':
                return handleWithdraw(req, res);
            default:
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_ACTION',
                        message: 'Invalid action specified'
                    }
                });
        }
    }
    
    return res.status(405).json({
        success: false,
        error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'HTTP method not allowed'
        }
    });
}

async function handleEstimate(req: NextApiRequest, res: NextApiResponse) {
    try {
        const gasLimit = Number(req.query.gasLimit);
        if (!gasLimit) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_GAS_LIMIT',
                    message: 'Gas limit required'
                }
            });
        }

        const fee = await gasRelayerService.estimateRelayerFee(gasLimit);
        return res.status(200).json({
            success: true,
            data: {
                fee: fee.toString()
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'ESTIMATION_FAILED',
                message: error.message
            }
        });
    }
}

async function handleBalance(req: NextApiRequest, res: NextApiResponse) {
    try {
        const relayer = req.query.relayer as string;
        if (!relayer || !ethers.isAddress(relayer)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_ADDRESS',
                    message: 'Valid relayer address required'
                }
            });
        }

        const balance = await gasRelayerService.getRelayerBalance(relayer);
        return res.status(200).json({
            success: true,
            data: {
                balance: balance.toString()
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'BALANCE_CHECK_FAILED',
                message: error.message
            }
        });
    }
}

async function handleCompensate(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { relayer, gasUsed } = req.body;
        if (!relayer || !ethers.isAddress(relayer) || !gasUsed) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMETERS',
                    message: 'Valid relayer address and gas used required'
                }
            });
        }

        await gasRelayerService.compensateRelayer(relayer, Number(gasUsed));
        return res.status(200).json({ success: true });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'COMPENSATION_FAILED',
                message: error.message
            }
        });
    }
}

async function handleWithdraw(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { relayer } = req.body;
        if (!relayer || !ethers.isAddress(relayer)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_ADDRESS',
                    message: 'Valid relayer address required'
                }
            });
        }

        // Create a wallet for the relayer
        const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY || '', provider);
        await gasRelayerService.withdrawRelayerBalance(relayer, relayerWallet);
        return res.status(200).json({ success: true });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'WITHDRAWAL_FAILED',
                message: error.message
            }
        });
    }
}

export default withRateLimit(handler); 