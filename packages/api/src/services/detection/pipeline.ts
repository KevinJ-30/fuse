import logger from '../../utils/logger';
import { calculateRiskScore } from '../../utils/risk-scorer';
import ruleEngine from './rule-engine';
import anomalyDetector from './anomaly-detector';
import semanticAnalyzer from './semantic-analyzer';
import { DetectionResult } from './types';

export class DetectionPipeline {
  /**
   * Run full detection pipeline on a tool execution
   * Orchestrates all three layers and combines results
   */
  async analyze(agentId: string, tool: string, input: any): Promise<DetectionResult> {
    const startTime = Date.now();

    logger.info({ agentId, tool }, 'Detection pipeline started');

    // ===== Layer 1: Rule Engine (always runs) =====
    const rulesStart = Date.now();
    const ruleViolations = await ruleEngine.analyze(agentId, tool, input);
    const rulesTime = Date.now() - rulesStart;

    // ===== Layer 2: Anomaly Detection (always runs) =====
    const anomaliesStart = Date.now();
    const anomalies = await anomalyDetector.analyze(agentId, tool, input);
    const anomaliesTime = Date.now() - anomaliesStart;

    // ===== Layer 3: Semantic Analysis (selective) =====
    const shouldRunSemantic = this.shouldRunSemanticAnalysis(
      tool,
      ruleViolations.length,
      anomalies.length
    );

    let semantic = null;
    let semanticTime: number | undefined;

    if (shouldRunSemantic) {
      const semanticStart = Date.now();
      semantic = await semanticAnalyzer.analyze(agentId, tool, input, {
        ruleViolations: ruleViolations.length,
        anomalies: anomalies.length,
        isHighStakes: semanticAnalyzer.isHighStakesTool(tool),
      });
      semanticTime = Date.now() - semanticStart;
    }

    // ===== Build Detection Result =====
    const detectionResult: DetectionResult = {
      rules: ruleViolations,
      anomalies,
      semantic: semantic || undefined,
      riskScore: 0, // Will be calculated below
      flags: {
        hasRuleViolations: ruleViolations.length > 0,
        hasAnomalies: anomalies.length > 0,
        hasSemanticConcerns: !!semantic && semantic.recommendation !== 'ALLOW',
      },
      layerExecutionTimes: {
        rules: rulesTime,
        anomalies: anomaliesTime,
        semantic: semanticTime,
        total: Date.now() - startTime,
      },
    };

    // ===== Calculate Risk Score =====
    detectionResult.riskScore = calculateRiskScore(detectionResult);

    const totalTime = Date.now() - startTime;

    logger.info(
      {
        agentId,
        tool,
        riskScore: detectionResult.riskScore,
        ruleViolations: ruleViolations.length,
        anomalies: anomalies.length,
        semanticRan: shouldRunSemantic,
        totalTime,
        timings: detectionResult.layerExecutionTimes,
      },
      'Detection pipeline complete'
    );

    return detectionResult;
  }

  /**
   * Determine if semantic analysis should run
   * Criteria:
   * - High-stakes tool (always)
   * - Rule violations detected
   * - Anomalies detected
   * - Random 5% sampling
   */
  private shouldRunSemanticAnalysis(
    tool: string,
    ruleViolationsCount: number,
    anomaliesCount: number
  ): boolean {
    // High-stakes tools always get semantic analysis
    if (semanticAnalyzer.isHighStakesTool(tool)) {
      return true;
    }

    // If other layers flagged issues
    if (ruleViolationsCount > 0 || anomaliesCount > 0) {
      return true;
    }

    // Random 5% sampling for baseline data
    if (Math.random() < 0.05) {
      return true;
    }

    return false;
  }

  /**
   * Get performance statistics for the detection pipeline
   */
  async getPerformanceStats(): Promise<{
    avgRulesTime: number;
    avgAnomaliesTime: number;
    avgSemanticTime: number;
    avgTotalTime: number;
  }> {
    // TODO: Collect and store timing metrics
    // For now, return placeholders
    return {
      avgRulesTime: 8,
      avgAnomaliesTime: 35,
      avgSemanticTime: 750,
      avgTotalTime: 50,
    };
  }
}

export default new DetectionPipeline();
