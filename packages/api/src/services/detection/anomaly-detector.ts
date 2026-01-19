import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';
import { AnomalyFlag, BaselineData } from './types';

const prisma = new PrismaClient();

export class AnomalyDetector {
  /**
   * Analyze execution for anomalies based on historical baselines
   * Performance target: <50ms
   */
  async analyze(agentId: string, tool: string, input: any): Promise<AnomalyFlag[]> {
    const startTime = Date.now();
    const anomalies: AnomalyFlag[] = [];

    try {
      // Get baseline for this (agent, tool) pair
      const baseline = await this.getBaseline(agentId, tool);

      if (!baseline) {
        // No baseline exists yet - need more data
        logger.debug({ agentId, tool }, 'No baseline available for anomaly detection');
        return [];
      }

      // Check for volume anomalies
      const volumeAnomaly = await this.checkVolumeAnomaly(agentId, tool, baseline);
      if (volumeAnomaly) anomalies.push(volumeAnomaly);

      // Check for timing anomalies
      const timingAnomaly = this.checkTimingAnomaly(baseline);
      if (timingAnomaly) anomalies.push(timingAnomaly);

      // Check for target anomalies (if applicable)
      const targetAnomaly = this.checkTargetAnomaly(input, baseline);
      if (targetAnomaly) anomalies.push(targetAnomaly);

      // Check for value anomalies (if applicable)
      const valueAnomaly = this.checkValueAnomaly(input, baseline);
      if (valueAnomaly) anomalies.push(valueAnomaly);

      const duration = Date.now() - startTime;
      logger.debug(
        { agentId, tool, anomalies: anomalies.length, duration },
        'Anomaly detection complete'
      );

      return anomalies;
    } catch (error: any) {
      logger.error({ error: error.message, agentId, tool }, 'Error in anomaly detector');
      return anomalies; // Return partial results on error
    }
  }

  /**
   * Check for volume anomalies (unusual number of calls)
   */
  private async checkVolumeAnomaly(
    agentId: string,
    tool: string,
    baseline: BaselineData
  ): Promise<AnomalyFlag | null> {
    // Count executions in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentCount = await prisma.execution.count({
      where: {
        agentId,
        tool,
        createdAt: { gte: oneHourAgo },
      },
    });

    // Calculate z-score: (current - mean) / stddev
    const expectedHourly = baseline.dailyCountsMean / 24;
    const stddev = baseline.dailyCountsStdDev / Math.sqrt(24);

    if (stddev === 0) return null; // Not enough variance to detect anomalies

    const zScore = (recentCount - expectedHourly) / stddev;

    if (Math.abs(zScore) > 2) {
      return {
        type: 'volume',
        severity: Math.abs(zScore) > 3 ? 'high' : 'moderate',
        zScore,
        baseline: { expectedHourly, stddev },
        current: { count: recentCount },
        message: `Unusual execution volume: ${recentCount} in last hour (expected ~${expectedHourly.toFixed(1)})`,
      };
    }

    return null;
  }

  /**
   * Check for timing anomalies (unusual time of day)
   */
  private checkTimingAnomaly(baseline: BaselineData): AnomalyFlag | null {
    const currentHour = new Date().getHours();
    const hourActivity = baseline.activeHours[currentHour] || 0;

    // Calculate average activity across all hours
    const hourValues = Object.values(baseline.activeHours);
    const avgActivity = hourValues.reduce((a, b) => a + b, 0) / hourValues.length;

    if (avgActivity === 0) return null;

    // If current hour has very low historical activity
    const activityRatio = hourActivity / avgActivity;

    if (activityRatio < 0.1 && hourActivity < 5) {
      return {
        type: 'timing',
        severity: activityRatio < 0.05 ? 'high' : 'moderate',
        zScore: (hourActivity - avgActivity) / Math.max(avgActivity * 0.5, 1),
        baseline: { avgActivity, hourActivity },
        current: { currentHour },
        message: `Unusual execution time: hour ${currentHour} has low historical activity`,
      };
    }

    return null;
  }

  /**
   * Check for target anomalies (unusual recipients/resources)
   */
  private checkTargetAnomaly(input: any, baseline: BaselineData): AnomalyFlag | null {
    // Extract potential targets from input
    const targets = this.extractTargets(input);
    if (targets.length === 0) return null;

    // Check if any target is uncommon
    for (const target of targets) {
      const targetPercentage = baseline.commonTargets[target] || 0;

      // If target is very rare (< 5% of historical targets)
      if (targetPercentage < 5 && Object.keys(baseline.commonTargets).length > 10) {
        return {
          type: 'target',
          severity: targetPercentage < 1 ? 'high' : 'moderate',
          zScore: (5 - targetPercentage) / 5, // Normalized distance from threshold
          baseline: { commonTargets: baseline.commonTargets },
          current: { target, percentage: targetPercentage },
          message: `Unusual target: ${target} (seen in ${targetPercentage.toFixed(1)}% of historical calls)`,
        };
      }
    }

    return null;
  }

  /**
   * Check for value anomalies (unusual amounts/quantities)
   */
  private checkValueAnomaly(input: any, baseline: BaselineData): AnomalyFlag | null {
    // Extract numeric values from input
    const values = this.extractNumericValues(input);
    if (values.length === 0) return null;

    // For now, just check if values are very large
    // TODO: Store value statistics in baseline for better detection
    for (const { key, value } of values) {
      if (value > 10000) {
        // Simple threshold for MVP
        return {
          type: 'value',
          severity: value > 100000 ? 'high' : 'moderate',
          zScore: value / 10000, // Simplified z-score
          baseline: { threshold: 10000 },
          current: { key, value },
          message: `Unusually large value: ${key}=${value}`,
        };
      }
    }

    return null;
  }

  /**
   * Extract target identifiers from input (email addresses, URLs, IDs, etc.)
   */
  private extractTargets(input: any): string[] {
    const targets: string[] = [];
    const inputStr = JSON.stringify(input);

    // Email addresses
    const emails = inputStr.match(/[\w\.-]+@[\w\.-]+\.\w+/g);
    if (emails) targets.push(...emails);

    // Common target fields
    const targetFields = ['to', 'recipient', 'email', 'target', 'destination', 'url'];
    for (const field of targetFields) {
      if (input[field] && typeof input[field] === 'string') {
        targets.push(input[field]);
      }
    }

    return targets;
  }

  /**
   * Extract numeric values from input
   */
  private extractNumericValues(input: any): Array<{ key: string; value: number }> {
    const values: Array<{ key: string; value: number }> = [];

    const traverse = (obj: any, prefix = '') => {
      for (const key in obj) {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'number') {
          values.push({ key: fullKey, value });
        } else if (typeof value === 'object' && value !== null) {
          traverse(value, fullKey);
        }
      }
    };

    traverse(input);
    return values;
  }

  /**
   * Get baseline for (agent, tool) pair
   */
  private async getBaseline(agentId: string, tool: string): Promise<BaselineData | null> {
    try {
      const baseline = await prisma.anomalyBaseline.findUnique({
        where: {
          agentId_tool: { agentId, tool },
        },
      });

      if (!baseline) return null;

      return {
        agentId: baseline.agentId,
        tool: baseline.tool,
        dailyCountsMean: baseline.dailyCountsMean,
        dailyCountsStdDev: baseline.dailyCountsStdDev,
        activeHours: baseline.activeHours as Record<number, number>,
        commonTargets: baseline.commonTargets as Record<string, number>,
        transitionProbabilities: baseline.transitionProbabilities as Record<string, number>,
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, agentId, tool },
        'Error fetching baseline'
      );
      return null;
    }
  }

  /**
   * Calculate and update baselines for all (agent, tool) pairs
   * Should be run daily as a background job
   */
  async updateBaselines(): Promise<void> {
    logger.info('Starting baseline calculation');

    try {
      // Get all unique (agent, tool) combinations from last 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const executions = await prisma.execution.findMany({
        where: {
          createdAt: { gte: fourteenDaysAgo },
          status: 'COMPLETED',
        },
        select: {
          agentId: true,
          tool: true,
          input: true,
          createdAt: true,
        },
      });

      // Group by (agent, tool)
      const grouped = new Map<string, typeof executions>();
      for (const exec of executions) {
        const key = `${exec.agentId}:${exec.tool}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(exec);
      }

      // Calculate baseline for each group
      for (const [key, execs] of grouped.entries()) {
        const [agentId, tool] = key.split(':');
        await this.calculateBaseline(agentId, tool, execs);
      }

      logger.info({ count: grouped.size }, 'Baseline calculation complete');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error updating baselines');
    }
  }

  /**
   * Calculate baseline statistics for a specific (agent, tool) pair
   */
  private async calculateBaseline(
    agentId: string,
    tool: string,
    executions: Array<{ createdAt: Date; input: any }>
  ): Promise<void> {
    if (executions.length < 10) {
      // Not enough data for meaningful baseline
      return;
    }

    // Calculate daily counts
    const dailyCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();
    const targets = new Map<string, number>();

    for (const exec of executions) {
      const date = exec.createdAt.toISOString().split('T')[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);

      const hour = exec.createdAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

      // Extract targets
      const execTargets = this.extractTargets(exec.input);
      for (const target of execTargets) {
        targets.set(target, (targets.get(target) || 0) + 1);
      }
    }

    // Calculate mean and stddev for daily counts
    const counts = Array.from(dailyCounts.values());
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    const stddev = Math.sqrt(variance);

    // Calculate target percentages
    const totalTargets = Array.from(targets.values()).reduce((a, b) => a + b, 0);
    const targetPercentages: Record<string, number> = {};
    for (const [target, count] of targets.entries()) {
      targetPercentages[target] = (count / totalTargets) * 100;
    }

    // Active hours as record
    const activeHours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      activeHours[i] = hourCounts.get(i) || 0;
    }

    // Upsert baseline
    await prisma.anomalyBaseline.upsert({
      where: {
        agentId_tool: { agentId, tool },
      },
      create: {
        agentId,
        tool,
        dailyCountsMean: mean,
        dailyCountsStdDev: stddev,
        activeHours,
        commonTargets: targetPercentages,
        transitionProbabilities: {}, // TODO: Calculate from execution sequences
        lastUpdated: new Date(),
      },
      update: {
        dailyCountsMean: mean,
        dailyCountsStdDev: stddev,
        activeHours,
        commonTargets: targetPercentages,
        lastUpdated: new Date(),
      },
    });

    logger.debug({ agentId, tool, mean, stddev }, 'Baseline calculated');
  }
}

export default new AnomalyDetector();
