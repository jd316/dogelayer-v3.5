export class AlertManager {
    private webhookUrl: string;
    private environment: string;

    constructor(webhookUrl: string, environment: string = 'production') {
        this.webhookUrl = webhookUrl;
        this.environment = environment;
    }

    async sendAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
        const alert = {
            title,
            message,
            severity,
            environment: this.environment,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alert)
            });

            if (!response.ok) {
                console.error(`Failed to send alert: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error sending alert:', error);
        }
    }

    async sendMetricAlert(
        metricName: string,
        value: number,
        threshold: number,
        comparison: 'above' | 'below'
    ): Promise<void> {
        const condition = comparison === 'above' ? value > threshold : value < threshold;
        if (condition) {
            await this.sendAlert(
                `Metric Alert: ${metricName}`,
                `${metricName} is ${comparison} threshold. Current: ${value}, Threshold: ${threshold}`,
                'warning'
            );
        }
    }

    async sendHealthCheck(
        service: string,
        status: 'healthy' | 'unhealthy',
        details?: string
    ): Promise<void> {
        await this.sendAlert(
            `Health Check: ${service}`,
            `Service ${service} is ${status}${details ? `: ${details}` : ''}`,
            status === 'healthy' ? 'info' : 'error'
        );
    }
} 