import { PrismaClient, Execution } from '@prisma/client';
import { getStrategy, hasStrategy } from '../strategies';
import { CompensationPlan, CompensationType } from '../strategies';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface CompensationResult {
  executionId: string;
  plans: CompensationPlan[];
  hasAutoReverse: boolean;
  requiresManual: boolean;
  isReversible: boolean;
}

export class CompensationService {
  /**
   * Generate compensation plans for an execution
   */
  async generateCompensation(executionId: string): Promise<CompensationResult> {
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      logger.info({ executionId, tool: execution.tool }, 'Generating compensation plan');

      // Get strategy for the tool
      const strategy = getStrategy(execution.tool);

      if (!strategy) {
        logger.warn({ tool: execution.tool }, 'No compensation strategy found');
        return {
          executionId,
          plans: [],
          hasAutoReverse: false,
          requiresManual: true,
          isReversible: false,
        };
      }

      // Generate compensation plans
      const plans = await strategy.generate(execution);

      // Analyze plans
      const hasAutoReverse = plans.some((p) => p.type === 'AUTO_REVERSE');
      const requiresManual = plans.some((p) => p.type === 'MANUAL_REQUIRED');
      const isReversible = plans.some(
        (p) => p.type === 'AUTO_REVERSE' || p.type === 'SUGGESTED' || p.type === 'MANUAL_REQUIRED'
      );

      logger.info(
        {
          executionId,
          planCount: plans.length,
          hasAutoReverse,
          requiresManual,
          isReversible,
        },
        'Compensation plan generated'
      );

      return {
        executionId,
        plans,
        hasAutoReverse,
        requiresManual,
        isReversible,
      };
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Error generating compensation');
      throw error;
    }
  }

  /**
   * Generate compensation plans for multiple executions
   */
  async generateBatchCompensation(executionIds: string[]): Promise<CompensationResult[]> {
    try {
      logger.info({ count: executionIds.length }, 'Generating batch compensation plans');

      const results = await Promise.all(
        executionIds.map((id) => this.generateCompensation(id))
      );

      return results;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error generating batch compensation');
      throw error;
    }
  }

  /**
   * Execute a compensation plan
   */
  async executeCompensation(
    executionId: string,
    planIndex: number = 0,
    options?: {
      dryRun?: boolean;
      modifiedInput?: any;
    }
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const compensationResult = await this.generateCompensation(executionId);

      if (!compensationResult.plans[planIndex]) {
        throw new Error(`No compensation plan at index ${planIndex}`);
      }

      const plan = compensationResult.plans[planIndex];

      // Check if plan requires manual action
      if (plan.type === 'MANUAL_REQUIRED' || plan.type === 'NOT_REVERSIBLE') {
        logger.warn(
          { executionId, planType: plan.type },
          'Cannot auto-execute this compensation type'
        );
        return {
          success: false,
          error: `This compensation requires manual intervention (${plan.type})`,
        };
      }

      // If dry run, just return what would happen
      if (options?.dryRun) {
        logger.info({ executionId, plan }, 'Dry run - compensation not executed');
        return {
          success: true,
          result: {
            dryRun: true,
            plan,
            message: 'Dry run successful - compensation would be executed',
          },
        };
      }

      // Execute the compensation
      const input = options?.modifiedInput || plan.input;

      logger.info(
        { executionId, tool: plan.tool, input },
        'Executing compensation'
      );

      // Here we would actually execute the tool
      // For now, we'll simulate it by creating a new execution record
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
      });

      const compensationExecution = await prisma.execution.create({
        data: {
          agentId: execution!.agentId,
          tool: plan.tool,
          input,
          status: 'SUCCESS',
          startedAt: new Date(),
          completedAt: new Date(),
          output: {
            compensation: true,
            originalExecutionId: executionId,
            planDescription: plan.description,
          },
          metadata: {
            isCompensation: true,
            compensatesFor: executionId,
            riskLevel: plan.riskLevel,
          },
        },
      });

      logger.info(
        { executionId, compensationExecutionId: compensationExecution.id },
        'Compensation executed successfully'
      );

      return {
        success: true,
        result: {
          compensationExecutionId: compensationExecution.id,
          plan,
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Error executing compensation');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if a tool has compensation support
   */
  hasCompensationSupport(tool: string): boolean {
    return hasStrategy(tool);
  }

  /**
   * Get compensation statistics
   */
  async getCompensationStats(): Promise<{
    totalCompensations: number;
    byTool: Array<{ tool: string; count: number }>;
    byRiskLevel: Record<string, number>;
    successRate: number;
  }> {
    try {
      const compensations = await prisma.execution.findMany({
        where: {
          metadata: {
            path: ['isCompensation'],
            equals: true,
          },
        },
      });

      const byTool: Record<string, number> = {};
      const byRiskLevel: Record<string, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };
      let successCount = 0;

      for (const comp of compensations) {
        byTool[comp.tool] = (byTool[comp.tool] || 0) + 1;

        const metadata = comp.metadata as any;
        if (metadata?.riskLevel) {
          byRiskLevel[metadata.riskLevel]++;
        }

        if (comp.status === 'SUCCESS') {
          successCount++;
        }
      }

      const byToolArray = Object.entries(byTool)
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count);

      const successRate = compensations.length > 0 ? successCount / compensations.length : 0;

      return {
        totalCompensations: compensations.length,
        byTool: byToolArray,
        byRiskLevel,
        successRate,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting compensation stats');
      throw error;
    }
  }
}

export default new CompensationService();
