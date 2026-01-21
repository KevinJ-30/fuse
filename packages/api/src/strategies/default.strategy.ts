import { Execution } from '@prisma/client';
import { CompensationStrategy, CompensationPlan } from './index';

export class DefaultStrategy implements CompensationStrategy {
  supports(tool: string): boolean {
    return true; // Fallback for all tools
  }

  async generate(execution: Execution): Promise<CompensationPlan[]> {
    const input = execution.input as any;

    // If we have previous state, suggest restoration
    if (execution.previousState) {
      return [
        {
          type: 'SUGGESTED',
          tool: execution.tool,
          input: {
            ...input,
            restoreState: execution.previousState,
          },
          description: `Restore previous state for ${execution.tool}`,
          riskLevel: 'MEDIUM',
          reasoning: 'Previous state available but no specific strategy defined - manual review recommended',
        },
      ];
    }

    // Check if it's a read-only operation (GET, LIST, SEARCH, etc.)
    const isReadOnly =
      execution.tool.toLowerCase().includes('get') ||
      execution.tool.toLowerCase().includes('list') ||
      execution.tool.toLowerCase().includes('search') ||
      execution.tool.toLowerCase().includes('read') ||
      execution.tool.toLowerCase().includes('fetch') ||
      execution.tool.toLowerCase().includes('query');

    if (isReadOnly) {
      return [
        {
          type: 'NO_ACTION_NEEDED',
          tool: execution.tool,
          input: {},
          description: `No action needed - ${execution.tool} is read-only`,
          riskLevel: 'LOW',
          reasoning: 'Read-only operations do not modify state',
        },
      ];
    }

    // Default case - require manual intervention
    return [
      {
        type: 'MANUAL_REQUIRED',
        tool: execution.tool,
        input: {},
        description: `Manual review required for ${execution.tool}`,
        riskLevel: 'MEDIUM',
        reasoning: 'No automated compensation strategy defined for this tool',
      },
    ];
  }
}

export default new DefaultStrategy();
