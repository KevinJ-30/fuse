import { Execution } from '@prisma/client';
import executionGraphService from './execution-graph.service';
import logger from '../utils/logger';

export interface BlastRadius {
  rootExecution: Execution;
  affected: Execution[];
  affectedCount: number;
  groupedByAgent: Record<string, Execution[]>;
  groupedByTool: Record<string, Execution[]>;
  groupedByStatus: Record<string, Execution[]>;
  timeSpan: {
    earliest: Date;
    latest: Date | null;
  };
  maxDepth: number;
}

export class BlastRadiusService {
  /**
   * Calculate blast radius for a given execution
   * Returns all affected executions in the dependency tree
   */
  async calculateBlastRadius(executionId: string): Promise<BlastRadius> {
    try {
      logger.info({ executionId }, 'Calculating blast radius');

      // Get the root execution
      const rootExecution = await executionGraphService.getExecutionTree(executionId);

      if (!rootExecution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      // Get all descendants
      const descendants = await executionGraphService.getDescendants(executionId);

      // Include root in affected list
      const affected = [rootExecution as Execution, ...descendants];

      // Group by agent
      const groupedByAgent: Record<string, Execution[]> = {};
      for (const execution of affected) {
        if (!groupedByAgent[execution.agentId]) {
          groupedByAgent[execution.agentId] = [];
        }
        groupedByAgent[execution.agentId].push(execution);
      }

      // Group by tool
      const groupedByTool: Record<string, Execution[]> = {};
      for (const execution of affected) {
        if (!groupedByTool[execution.tool]) {
          groupedByTool[execution.tool] = [];
        }
        groupedByTool[execution.tool].push(execution);
      }

      // Group by status
      const groupedByStatus: Record<string, Execution[]> = {};
      for (const execution of affected) {
        if (!groupedByStatus[execution.status]) {
          groupedByStatus[execution.status] = [];
        }
        groupedByStatus[execution.status].push(execution);
      }

      // Calculate time span
      const timestamps = affected.map((e) => e.startedAt.getTime());
      const completedTimes = affected
        .filter((e) => e.completedAt)
        .map((e) => e.completedAt!.getTime());

      const earliest = new Date(Math.min(...timestamps));
      const latest = completedTimes.length > 0 ? new Date(Math.max(...completedTimes)) : null;

      // Calculate max depth
      const depths = await Promise.all(
        affected.map((e) => executionGraphService.getExecutionDepth(e.id))
      );
      const maxDepth = Math.max(...depths, 0);

      const blastRadius: BlastRadius = {
        rootExecution: rootExecution as Execution,
        affected,
        affectedCount: affected.length,
        groupedByAgent,
        groupedByTool,
        groupedByStatus,
        timeSpan: { earliest, latest },
        maxDepth,
      };

      logger.info(
        {
          executionId,
          affectedCount: blastRadius.affectedCount,
          agentCount: Object.keys(groupedByAgent).length,
          toolCount: Object.keys(groupedByTool).length,
          maxDepth,
        },
        'Blast radius calculated'
      );

      return blastRadius;
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Error calculating blast radius');
      throw error;
    }
  }

  /**
   * Get summary statistics for blast radius
   */
  getSummary(blastRadius: BlastRadius): {
    totalAffected: number;
    byAgent: Array<{ agentId: string; count: number }>;
    byTool: Array<{ tool: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    duration: number | null;
  } {
    const byAgent = Object.entries(blastRadius.groupedByAgent).map(([agentId, executions]) => ({
      agentId,
      count: executions.length,
    }));

    const byTool = Object.entries(blastRadius.groupedByTool).map(([tool, executions]) => ({
      tool,
      count: executions.length,
    }));

    const byStatus = Object.entries(blastRadius.groupedByStatus).map(([status, executions]) => ({
      status,
      count: executions.length,
    }));

    let duration: number | null = null;
    if (blastRadius.timeSpan.latest) {
      duration = blastRadius.timeSpan.latest.getTime() - blastRadius.timeSpan.earliest.getTime();
    }

    return {
      totalAffected: blastRadius.affectedCount,
      byAgent: byAgent.sort((a, b) => b.count - a.count),
      byTool: byTool.sort((a, b) => b.count - a.count),
      byStatus: byStatus.sort((a, b) => b.count - a.count),
      duration,
    };
  }

  /**
   * Check if blast radius is safe to rollback
   * Returns warnings if blast radius is too large or complex
   */
  validateForRollback(blastRadius: BlastRadius): {
    isSafe: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let isSafe = true;

    // Check total count
    if (blastRadius.affectedCount > 100) {
      warnings.push(`Large blast radius: ${blastRadius.affectedCount} affected executions`);
      recommendations.push('Consider rolling back in smaller batches');
      isSafe = false;
    }

    // Check depth
    if (blastRadius.maxDepth > 10) {
      warnings.push(`Deep execution tree: ${blastRadius.maxDepth} levels`);
      recommendations.push('Review execution chain carefully before rollback');
    }

    // Check multiple agents
    const agentCount = Object.keys(blastRadius.groupedByAgent).length;
    if (agentCount > 5) {
      warnings.push(`Multiple agents affected: ${agentCount} different agents`);
      recommendations.push('Coordinate with all affected agent owners');
    }

    // Check for failed executions
    const failedCount = blastRadius.groupedByStatus['FAILED']?.length || 0;
    if (failedCount > 0) {
      warnings.push(`${failedCount} executions already failed`);
      recommendations.push('Review failed executions - they may not need rollback');
    }

    // Check for already rolled back
    const rolledBackCount = blastRadius.groupedByStatus['ROLLED_BACK']?.length || 0;
    if (rolledBackCount > 0) {
      warnings.push(`${rolledBackCount} executions already rolled back`);
      recommendations.push('Avoid double-rollback of same executions');
      isSafe = false;
    }

    // Check time span
    if (blastRadius.timeSpan.latest) {
      const durationHours =
        (blastRadius.timeSpan.latest.getTime() - blastRadius.timeSpan.earliest.getTime()) /
        (1000 * 60 * 60);

      if (durationHours > 24) {
        warnings.push(`Long time span: ${Math.round(durationHours)} hours`);
        recommendations.push('Some executions may be too old to reverse safely');
      }
    }

    return { isSafe, warnings, recommendations };
  }
}

export default new BlastRadiusService();
