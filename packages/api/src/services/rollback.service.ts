import { PrismaClient, ExecutionStatus } from '@prisma/client';
import executionGraphService from './execution-graph.service';
import blastRadiusService from './blast-radius.service';
import compensationService from './compensation.service';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export type RollbackStrategy = 'SINGLE' | 'TREE' | 'CHAIN';

export interface RollbackOptions {
  strategy?: RollbackStrategy;
  dryRun?: boolean;
  autoApprove?: boolean;
  reviewedBy?: string;
  reason?: string;
}

export interface RollbackResult {
  rollbackId: string;
  executionId: string;
  strategy: RollbackStrategy;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  blastRadius: {
    total: number;
    affected: number;
  };
  compensations: {
    executed: number;
    failed: number;
    skipped: number;
    manual: number;
  };
  executions: Array<{
    executionId: string;
    tool: string;
    compensationStatus: 'EXECUTED' | 'FAILED' | 'SKIPPED' | 'MANUAL_REQUIRED';
    error?: string;
  }>;
  warnings: string[];
  createdAt: Date;
  completedAt?: Date;
}

export class RollbackService {
  /**
   * Initiate a rollback for an execution
   */
  async rollback(executionId: string, options: RollbackOptions = {}): Promise<RollbackResult> {
    const {
      strategy = 'SINGLE',
      dryRun = false,
      autoApprove = false,
      reviewedBy = 'system',
      reason = 'Manual rollback',
    } = options;

    try {
      logger.info({ executionId, strategy, dryRun }, 'Initiating rollback');

      // Create rollback record
      const rollback = await prisma.rollback.create({
        data: {
          executionId,
          strategy,
          status: 'IN_PROGRESS',
          initiatedBy: reviewedBy,
          reason,
          blastRadius: {},
          compensations: {},
        },
      });

      // Calculate blast radius
      const blastRadius = await blastRadiusService.calculateBlastRadius(executionId);
      const validation = blastRadiusService.validateForRollback(blastRadius);

      // Check if safe to proceed
      if (!autoApprove && !validation.isSafe && !dryRun) {
        await prisma.rollback.update({
          where: { id: rollback.id },
          data: {
            status: 'PENDING_APPROVAL',
            blastRadius: {
              total: blastRadius.affectedCount,
              warnings: validation.warnings,
              recommendations: validation.recommendations,
            },
          },
        });

        throw new Error(
          `Rollback requires approval. Warnings: ${validation.warnings.join(', ')}`
        );
      }

      // Determine which executions to rollback based on strategy
      let executionsToRollback = [];

      switch (strategy) {
        case 'SINGLE':
          // Just the single execution
          executionsToRollback = [blastRadius.rootExecution];
          break;

        case 'CHAIN':
          // All ancestors (chain from root to this execution)
          const chain = await executionGraphService.getExecutionChain(executionId);
          executionsToRollback = chain;
          break;

        case 'TREE':
          // All descendants (full tree)
          executionsToRollback = blastRadius.affected;
          break;
      }

      logger.info(
        { rollbackId: rollback.id, count: executionsToRollback.length },
        'Executions to rollback'
      );

      // Sort by depth (deepest first for proper compensation order)
      const executionsWithDepth = await executionGraphService.getExecutionsWithDepth(
        executionsToRollback.map((e) => e.id)
      );
      executionsWithDepth.sort((a, b) => b.depth - a.depth);

      // Execute compensations
      const results = [];
      let executed = 0;
      let failed = 0;
      let skipped = 0;
      let manual = 0;

      for (const { execution } of executionsWithDepth) {
        // Skip already rolled back
        if (execution.status === ExecutionStatus.ROLLED_BACK) {
          skipped++;
          results.push({
            executionId: execution.id,
            tool: execution.tool,
            compensationStatus: 'SKIPPED' as const,
          });
          continue;
        }

        // Skip failed executions (nothing to rollback)
        if (execution.status === ExecutionStatus.FAILED) {
          skipped++;
          results.push({
            executionId: execution.id,
            tool: execution.tool,
            compensationStatus: 'SKIPPED' as const,
          });
          continue;
        }

        try {
          // Generate compensation
          const compensation = await compensationService.generateCompensation(execution.id);

          if (!compensation.plans.length || !compensation.isReversible) {
            manual++;
            results.push({
              executionId: execution.id,
              tool: execution.tool,
              compensationStatus: 'MANUAL_REQUIRED' as const,
            });
            continue;
          }

          // Execute compensation (first plan with AUTO_REVERSE if available, otherwise first SUGGESTED)
          const autoReversePlan = compensation.plans.find((p) => p.type === 'AUTO_REVERSE');
          const planIndex = autoReversePlan
            ? compensation.plans.indexOf(autoReversePlan)
            : 0;

          const result = await compensationService.executeCompensation(
            execution.id,
            planIndex,
            { dryRun }
          );

          if (result.success) {
            executed++;

            // Mark execution as rolled back
            if (!dryRun) {
              await prisma.execution.update({
                where: { id: execution.id },
                data: {
                  status: ExecutionStatus.ROLLED_BACK,
                  metadata: {
                    ...(execution.metadata as any),
                    rolledBackAt: new Date().toISOString(),
                    rollbackId: rollback.id,
                  },
                },
              });
            }

            results.push({
              executionId: execution.id,
              tool: execution.tool,
              compensationStatus: 'EXECUTED' as const,
            });
          } else {
            failed++;
            results.push({
              executionId: execution.id,
              tool: execution.tool,
              compensationStatus: 'FAILED' as const,
              error: result.error,
            });
          }
        } catch (error: any) {
          logger.error(
            { error: error.message, executionId: execution.id },
            'Error executing compensation'
          );
          failed++;
          results.push({
            executionId: execution.id,
            tool: execution.tool,
            compensationStatus: 'FAILED' as const,
            error: error.message,
          });
        }
      }

      // Determine overall status
      let status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
      if (failed === 0 && manual === 0) {
        status = 'COMPLETED';
      } else if (executed > 0) {
        status = 'PARTIAL';
      } else {
        status = 'FAILED';
      }

      // Update rollback record
      const completedAt = new Date();
      await prisma.rollback.update({
        where: { id: rollback.id },
        data: {
          status: dryRun ? 'DRY_RUN' : status,
          completedAt,
          blastRadius: {
            total: executionsToRollback.length,
            affected: executed,
          },
          compensations: {
            executed,
            failed,
            skipped,
            manual,
          },
        },
      });

      const rollbackResult: RollbackResult = {
        rollbackId: rollback.id,
        executionId,
        strategy,
        status,
        blastRadius: {
          total: executionsToRollback.length,
          affected: executed,
        },
        compensations: {
          executed,
          failed,
          skipped,
          manual,
        },
        executions: results,
        warnings: validation.warnings,
        createdAt: rollback.createdAt,
        completedAt,
      };

      logger.info(
        {
          rollbackId: rollback.id,
          status,
          executed,
          failed,
          manual,
        },
        'Rollback completed'
      );

      return rollbackResult;
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Rollback failed');
      throw error;
    }
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(filters?: {
    executionId?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const where: any = {};

      if (filters?.executionId) {
        where.executionId = filters.executionId;
      }

      const rollbacks = await prisma.rollback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        include: {
          execution: true,
        },
      });

      return rollbacks;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting rollback history');
      throw error;
    }
  }

  /**
   * Get rollback details
   */
  async getRollbackDetails(rollbackId: string): Promise<any> {
    try {
      const rollback = await prisma.rollback.findUnique({
        where: { id: rollbackId },
        include: {
          execution: true,
        },
      });

      return rollback;
    } catch (error: any) {
      logger.error({ error: error.message, rollbackId }, 'Error getting rollback details');
      throw error;
    }
  }

  /**
   * Get rollback statistics
   */
  async getRollbackStats(): Promise<{
    total: number;
    byStrategy: Record<string, number>;
    byStatus: Record<string, number>;
    successRate: number;
  }> {
    try {
      const rollbacks = await prisma.rollback.findMany();

      const byStrategy: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let completedCount = 0;

      for (const rollback of rollbacks) {
        byStrategy[rollback.strategy] = (byStrategy[rollback.strategy] || 0) + 1;
        byStatus[rollback.status] = (byStatus[rollback.status] || 0) + 1;

        if (rollback.status === 'COMPLETED') {
          completedCount++;
        }
      }

      const successRate = rollbacks.length > 0 ? completedCount / rollbacks.length : 0;

      return {
        total: rollbacks.length,
        byStrategy,
        byStatus,
        successRate,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting rollback stats');
      throw error;
    }
  }
}

export default new RollbackService();
