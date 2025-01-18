import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { GasRelayerService } from '../../../services/gasRelayer/GasRelayerService';
import { AlertManager } from '../../../services/monitoring/AlertManager';

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const alertManager = new AlertManager(process.env.ALERT_WEBHOOK_URL || '');

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Check provider connection
        const network = await provider.getNetwork();
        const isProviderConnected = Number(network.chainId) === Number(process.env.POLYGON_CHAIN_ID);

        // Check gas price
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? BigInt(0);
        const maxGasPrice = ethers.parseUnits(process.env.MAX_GAS_PRICE || "500", "gwei");
        const isGasPriceOk = gasPrice <= maxGasPrice;

        // Get contract statuses
        const contracts = {
            gasRelayer: process.env.GAS_RELAYER_CONTRACT_ADDRESS,
            wdoge: process.env.WDOGE_CONTRACT_ADDRESS,
            bridge: process.env.BRIDGE_CONTRACT_ADDRESS,
            staking: process.env.STAKING_CONTRACT_ADDRESS,
            lending: process.env.LENDING_CONTRACT_ADDRESS
        };

        const contractStatuses = Object.entries(contracts).reduce((acc, [name, address]) => {
            acc[name] = {
                configured: Boolean(address && ethers.isAddress(address)),
                address
            };
            return acc;
        }, {} as Record<string, { configured: boolean; address: string | undefined }>);

        const status = {
            provider: {
                connected: isProviderConnected,
                network: network.name,
                chainId: Number(network.chainId)
            },
            gasPrice: {
                current: ethers.formatUnits(gasPrice, "gwei"),
                max: ethers.formatUnits(maxGasPrice, "gwei"),
                ok: isGasPriceOk
            },
            contracts: contractStatuses,
            timestamp: new Date().toISOString()
        };

        // Send health status alert
        const isHealthy = isProviderConnected && isGasPriceOk && 
            Object.values(contractStatuses).every(s => s.configured);

        await alertManager.sendHealthCheck(
            'GasRelayer Service',
            isHealthy ? 'healthy' : 'unhealthy',
            JSON.stringify(status, null, 2)
        );

        return res.status(isHealthy ? 200 : 503).json({
            success: true,
            data: {
                healthy: isHealthy,
                status
            }
        });
    } catch (error: any) {
        await alertManager.sendHealthCheck(
            'GasRelayer Service',
            'unhealthy',
            `Health check failed: ${error.message}`
        );

        return res.status(500).json({
            success: false,
            error: {
                code: 'HEALTH_CHECK_FAILED',
                message: error.message
            }
        });
    }
}

export default handler; 