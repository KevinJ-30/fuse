import { Policy, PolicyAction } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';

export interface PolicyDecision {
  action: PolicyAction;
  matchedPolicy?: Policy;
  reason?: string;
}

export class PolicyService {
  /**
   * Evaluate all policies for a given tool execution
   * Returns the first matching policy's action, or ALLOW if no matches
   */
  async evaluatePolicies(
    agentId: string,
    tool: string,
    input: any
  ): Promise<PolicyDecision> {
    try {
      // Fetch enabled policies for this tool, ordered by priority (ascending = higher priority)
      const policies = await prisma.policy.findMany({
        where: {
          enabled: true,
          tool,
        },
        orderBy: {
          priority: 'asc',
        },
      });

      logger.debug(
        { agentId, tool, policyCount: policies.length },
        'Evaluating policies'
      );

      // Evaluate each policy in priority order
      for (const policy of policies) {
        const matches = await this.evaluateCondition(policy, agentId, input);

        if (matches) {
          logger.info(
            {
              agentId,
              tool,
              policyId: policy.id,
              policyName: policy.name,
              action: policy.action,
            },
            'Policy matched'
          );

          return {
            action: policy.action,
            matchedPolicy: policy,
            reason: `Matched policy: ${policy.name}`,
          };
        }
      }

      // No policies matched - default to ALLOW
      logger.debug({ agentId, tool }, 'No policies matched, defaulting to ALLOW');
      return {
        action: PolicyAction.ALLOW,
        reason: 'No matching policies',
      };
    } catch (error: any) {
      logger.error({ error: error.message, agentId, tool }, 'Error evaluating policies');
      // On error, fail open to ALLOW (could be configured to fail closed)
      return {
        action: PolicyAction.ALLOW,
        reason: 'Error evaluating policies - defaulting to ALLOW',
      };
    }
  }

  /**
   * Evaluate if a policy's condition matches the input
   * If no condition exists, policy always matches
   */
  private async evaluateCondition(
    policy: Policy,
    agentId: string,
    input: any
  ): Promise<boolean> {
    // No condition means policy always applies to this tool
    if (!policy.condition) {
      return true;
    }

    try {
      const condition = policy.condition as string;
      return this.parseAndEvaluateCondition(condition, agentId, input);
    } catch (error: any) {
      logger.error(
        { error: error.message, policyId: policy.id, condition: policy.condition },
        'Error parsing policy condition'
      );
      return false;
    }
  }

  /**
   * Parse and evaluate a condition string
   * Supported format: "field OPERATOR value"
   * Examples:
   *   - "args.to CONTAINS @customer.com"
   *   - "args.amount GREATER_THAN 1000"
   *   - "agentId EQUALS sales_bot"
   */
  private parseAndEvaluateCondition(
    condition: string,
    agentId: string,
    input: any
  ): boolean {
    const parts = condition.trim().split(/\s+/);
    if (parts.length < 3) {
      logger.warn({ condition }, 'Invalid condition format');
      return false;
    }

    const field = parts[0];
    const operator = parts[1];
    const expectedValue = parts.slice(2).join(' ');

    // Get actual value from input or context
    const actualValue = this.getFieldValue(field, agentId, input);

    return this.evaluateOperator(operator, actualValue, expectedValue);
  }

  /**
   * Extract field value from input using dot notation
   * Supports: args.fieldName, agentId, tool
   */
  private getFieldValue(field: string, agentId: string, input: any): any {
    if (field === 'agentId') {
      return agentId;
    }

    if (field.startsWith('args.')) {
      const fieldPath = field.substring(5); // Remove 'args.' prefix
      return this.getNestedValue(input, fieldPath);
    }

    return undefined;
  }

  /**
   * Get nested value from object using dot notation
   * Example: "user.email" -> input.user.email
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Evaluate operator against actual and expected values
   */
  private evaluateOperator(
    operator: string,
    actualValue: any,
    expectedValue: string
  ): boolean {
    const actualStr = String(actualValue || '');
    const actualNum = Number(actualValue);

    switch (operator.toUpperCase()) {
      case 'CONTAINS':
        return actualStr.toLowerCase().includes(expectedValue.toLowerCase());

      case 'EQUALS':
        return actualStr === expectedValue;

      case 'STARTS_WITH':
        return actualStr.toLowerCase().startsWith(expectedValue.toLowerCase());

      case 'ENDS_WITH':
        return actualStr.toLowerCase().endsWith(expectedValue.toLowerCase());

      case 'GREATER_THAN':
      case 'GT':
        return !isNaN(actualNum) && actualNum > Number(expectedValue);

      case 'LESS_THAN':
      case 'LT':
        return !isNaN(actualNum) && actualNum < Number(expectedValue);

      case 'GREATER_THAN_OR_EQUAL':
      case 'GTE':
        return !isNaN(actualNum) && actualNum >= Number(expectedValue);

      case 'LESS_THAN_OR_EQUAL':
      case 'LTE':
        return !isNaN(actualNum) && actualNum <= Number(expectedValue);

      case 'NOT_EQUALS':
      case 'NEQ':
        return actualStr !== expectedValue;

      default:
        logger.warn({ operator }, 'Unknown operator');
        return false;
    }
  }

  /**
   * Create a new policy
   */
  async createPolicy(data: {
    name: string;
    tool: string;
    condition?: string;
    action: PolicyAction;
    priority?: number;
  }): Promise<Policy> {
    const policy = await prisma.policy.create({
      data: {
        name: data.name,
        tool: data.tool,
        condition: data.condition || null,
        action: data.action,
        enabled: true,
        priority: data.priority || 100,
      },
    });

    logger.info({ policyId: policy.id, name: policy.name }, 'Policy created');
    return policy;
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(
    id: string,
    data: Partial<{
      name: string;
      tool: string;
      condition: string | null;
      action: PolicyAction;
      enabled: boolean;
      priority: number;
    }>
  ): Promise<Policy> {
    const policy = await prisma.policy.update({
      where: { id },
      data,
    });

    logger.info({ policyId: policy.id, name: policy.name }, 'Policy updated');
    return policy;
  }

  /**
   * Toggle policy enabled state
   */
  async togglePolicy(id: string, enabled: boolean): Promise<Policy> {
    const policy = await prisma.policy.update({
      where: { id },
      data: { enabled },
    });

    logger.info(
      { policyId: policy.id, name: policy.name, enabled },
      'Policy toggled'
    );
    return policy;
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string): Promise<void> {
    await prisma.policy.delete({
      where: { id },
    });

    logger.info({ policyId: id }, 'Policy deleted');
  }

  /**
   * List all policies
   */
  async listPolicies(filters?: {
    tool?: string;
    enabled?: boolean;
  }): Promise<Policy[]> {
    return prisma.policy.findMany({
      where: {
        tool: filters?.tool,
        enabled: filters?.enabled,
      },
      orderBy: {
        priority: 'asc',
      },
    });
  }

  /**
   * Get a single policy by ID
   */
  async getPolicy(id: string): Promise<Policy | null> {
    return prisma.policy.findUnique({
      where: { id },
    });
  }
}

export default new PolicyService();
