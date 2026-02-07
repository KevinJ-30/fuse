import { RefundAgent } from '@relay/demo-agent';

let agentInstance: RefundAgent | null = null;

export function getDemoAgent(): RefundAgent {
  if (!agentInstance) {
    agentInstance = new RefundAgent(
      process.env.FUSE_API_URL || 'http://localhost:3001',
      process.env.FUSE_API_KEY || 'demo-agent-key',
      'customer_service_refund_bot'
    );
  }
  return agentInstance;
}

export function isAgentRunning(): boolean {
  return agentInstance !== null && typeof agentInstance.isRunning === 'function'
    ? agentInstance.isRunning()
    : false;
}
