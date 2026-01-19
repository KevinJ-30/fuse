import { Execution } from '@prisma/client';
import { CompensationStrategy, CompensationPlan } from './index';

export class StripeStrategy implements CompensationStrategy {
  supports(tool: string): boolean {
    return tool.startsWith('stripe_');
  }

  async generate(execution: Execution): Promise<CompensationPlan[]> {
    const input = execution.input as any;
    const output = execution.output as any;

    switch (execution.tool) {
      case 'stripe_charge':
      case 'stripe_payment':
        // Can issue refund
        return [
          {
            type: 'SUGGESTED',
            tool: 'stripe_refund',
            input: {
              chargeId: output?.chargeId || output?.id,
              amount: input.amount,
              reason: 'requested_by_customer',
              metadata: {
                rollback: true,
                originalExecutionId: execution.id,
              },
            },
            description: `Refund $${(input.amount / 100).toFixed(2)} to ${input.customer || 'customer'}`,
            riskLevel: 'HIGH',
            reasoning: 'Refunds are financial operations that should be reviewed',
          },
        ];

      case 'stripe_refund':
        // Cannot reverse a refund
        return [
          {
            type: 'NOT_REVERSIBLE',
            tool: 'stripe_refund',
            input: {},
            description: 'Cannot reverse a refund - would require new charge',
            riskLevel: 'CRITICAL',
            reasoning: 'Refunds are irreversible; new charge would require customer authorization',
          },
        ];

      case 'stripe_create_customer':
        // Can delete customer if no charges
        return [
          {
            type: 'SUGGESTED',
            tool: 'stripe_delete_customer',
            input: {
              customerId: output?.customerId || output?.id,
            },
            description: `Delete customer ${output?.customerId || output?.id}`,
            riskLevel: 'MEDIUM',
            reasoning: 'Customer deletion is safe if no active subscriptions or charges',
          },
        ];

      case 'stripe_create_subscription':
        // Can cancel subscription
        return [
          {
            type: 'AUTO_REVERSE',
            tool: 'stripe_cancel_subscription',
            input: {
              subscriptionId: output?.subscriptionId || output?.id,
              immediately: true,
            },
            description: `Cancel subscription ${output?.subscriptionId || output?.id}`,
            riskLevel: 'MEDIUM',
            reasoning: 'Subscriptions can be safely canceled',
          },
        ];

      case 'stripe_update_customer':
        // Can restore if we have previous state
        if (execution.previousState) {
          return [
            {
              type: 'AUTO_REVERSE',
              tool: 'stripe_update_customer',
              input: {
                customerId: input.customerId,
                ...(execution.previousState as any),
              },
              description: `Restore customer ${input.customerId} to previous state`,
              riskLevel: 'LOW',
              reasoning: 'Previous state available, can safely restore',
            },
          ];
        }

        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: 'stripe_update_customer',
            input: { customerId: input.customerId },
            description: `Manually restore customer ${input.customerId}`,
            riskLevel: 'MEDIUM',
            reasoning: 'No previous state saved, manual restoration required',
          },
        ];

      default:
        return [
          {
            type: 'MANUAL_REQUIRED',
            tool: execution.tool,
            input: {},
            description: `Manual intervention required for ${execution.tool}`,
            riskLevel: 'MEDIUM',
            reasoning: 'No automated compensation strategy for this Stripe operation',
          },
        ];
    }
  }
}

export default new StripeStrategy();
