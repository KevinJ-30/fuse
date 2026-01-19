import { Execution } from '@prisma/client';
import { CompensationStrategy, CompensationPlan } from './index';

export class EmailStrategy implements CompensationStrategy {
  supports(tool: string): boolean {
    return tool === 'send_email' || tool.startsWith('email_');
  }

  async generate(execution: Execution): Promise<CompensationPlan[]> {
    const input = execution.input as any;

    // For email, we can't unsend it, but we can send a correction
    return [
      {
        type: 'SUGGESTED',
        tool: 'send_email',
        input: {
          to: input.to,
          subject: `CORRECTION: ${input.subject || 'Previous Email'}`,
          body: `This is a correction to a previous email sent in error.\n\nThe previous email has been retracted. Please disregard it.\n\nApologies for any confusion.`,
          replyTo: input.from,
          threadId: execution.output?.messageId, // Thread with original if available
        },
        description: `Send correction email to ${input.to}`,
        riskLevel: 'LOW',
        reasoning: 'Cannot unsend email, but can send correction message',
      },
    ];
  }
}

export default new EmailStrategy();
