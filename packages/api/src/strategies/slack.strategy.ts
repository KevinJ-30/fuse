import { Execution } from '@prisma/client';
import { CompensationStrategy, CompensationPlan } from './index';

export class SlackStrategy implements CompensationStrategy {
  supports(tool: string): boolean {
    return tool === 'slack_message' || tool === 'slack_post' || tool.startsWith('slack_');
  }

  async generate(execution: Execution): Promise<CompensationPlan[]> {
    const input = execution.input as any;
    const output = execution.output as any;

    // Check if we have the message ID from the output
    if (output?.messageId || output?.ts) {
      // Can delete the message
      return [
        {
          type: 'AUTO_REVERSE',
          tool: 'slack_delete_message',
          input: {
            channel: input.channel,
            messageId: output.messageId || output.ts,
          },
          description: `Delete message from ${input.channel}`,
          riskLevel: 'LOW',
          reasoning: 'Slack allows deletion of messages within API limits',
        },
      ];
    }

    // If no message ID, can't delete - suggest manual action
    return [
      {
        type: 'MANUAL_REQUIRED',
        tool: 'slack_delete_message',
        input: {
          channel: input.channel,
        },
        description: `Manually delete message from ${input.channel}`,
        riskLevel: 'MEDIUM',
        reasoning: 'Message ID not available, manual deletion required',
      },
    ];
  }
}

export default new SlackStrategy();
