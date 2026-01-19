import { RuleSeverity } from '@prisma/client';
import { DetectionResult, RuleViolation, AnomalyFlag, SemanticAnalysis } from '../services/detection/types';
import logger from './logger';

/**
 * Calculate risk score from detection results
 * Returns a score from 0.0 (no risk) to 1.0 (critical risk)
 *
 * Thresholds:
 * - < 0.3: Auto-approve
 * - 0.3 - 0.95: Require approval
 * - > 0.95: Auto-block
 */
export function calculateRiskScore(detectionResult: DetectionResult): number {
  let score = 0.0;

  // ===== Layer 1: Rule Violations =====
  // Take the maximum severity score from all rule violations
  if (detectionResult.rules.length > 0) {
    const ruleScore = Math.max(
      ...detectionResult.rules.map((rule) => severityToScore(rule.severity))
    );
    score = Math.max(score, ruleScore);

    logger.debug(
      { ruleViolations: detectionResult.rules.length, ruleScore },
      'Rule violations impact on risk score'
    );
  }

  // ===== Layer 2: Anomalies =====
  // Calculate score based on z-scores and severity
  if (detectionResult.anomalies.length > 0) {
    for (const anomaly of detectionResult.anomalies) {
      // Convert z-score to risk score (capped at 0.7)
      const anomalyScore = Math.min(Math.abs(anomaly.zScore) / 5, 0.7);

      // Apply severity multiplier
      const multiplier = anomaly.severity === 'high' ? 1.2 : 1.0;
      const adjustedScore = Math.min(anomalyScore * multiplier, 0.7);

      score = Math.max(score, adjustedScore);
    }

    logger.debug(
      { anomalies: detectionResult.anomalies.length, score },
      'Anomalies impact on risk score'
    );
  }

  // ===== Layer 3: Semantic Analysis =====
  // Weight semantic recommendation by confidence
  if (detectionResult.semantic) {
    const semanticScore = recommendationToScore(detectionResult.semantic.recommendation);
    const weightedScore = semanticScore * detectionResult.semantic.confidence;
    score = Math.max(score, weightedScore);

    logger.debug(
      {
        recommendation: detectionResult.semantic.recommendation,
        confidence: detectionResult.semantic.confidence,
        semanticScore,
        weightedScore,
      },
      'Semantic analysis impact on risk score'
    );
  }

  // ===== Composite Scoring =====
  // If multiple layers flag issues, increase the score slightly
  const layerCount =
    (detectionResult.rules.length > 0 ? 1 : 0) +
    (detectionResult.anomalies.length > 0 ? 1 : 0) +
    (detectionResult.semantic ? 1 : 0);

  if (layerCount >= 2) {
    // Multiple layers flagging increases confidence
    score = Math.min(score * 1.15, 1.0);

    logger.debug({ layerCount, adjustedScore: score }, 'Multi-layer detection boost');
  }

  // Ensure score is within bounds
  const finalScore = Math.min(Math.max(score, 0.0), 1.0);

  logger.info(
    {
      finalScore,
      rules: detectionResult.rules.length,
      anomalies: detectionResult.anomalies.length,
      hasSemantic: !!detectionResult.semantic,
    },
    'Risk score calculated'
  );

  return finalScore;
}

/**
 * Convert rule severity to risk score
 */
function severityToScore(severity: RuleSeverity): number {
  const scoreMap: Record<RuleSeverity, number> = {
    CRITICAL: 0.9,
    HIGH: 0.5,
    MEDIUM: 0.25,
    LOW: 0.1,
  };

  return scoreMap[severity] || 0.0;
}

/**
 * Convert semantic recommendation to risk score
 */
function recommendationToScore(recommendation: string): number {
  const scoreMap: Record<string, number> = {
    ALLOW: 0.1,
    FLAG_FOR_REVIEW: 0.6,
    BLOCK: 0.95,
  };

  return scoreMap[recommendation] || 0.5;
}

/**
 * Determine action based on risk score and thresholds
 */
export function determineAction(riskScore: number): {
  action: 'approve' | 'review' | 'block';
  reason: string;
} {
  if (riskScore < 0.3) {
    return {
      action: 'approve',
      reason: 'Risk score below threshold for auto-approval',
    };
  }

  if (riskScore <= 0.95) {
    return {
      action: 'review',
      reason: 'Risk score requires human review',
    };
  }

  return {
    action: 'block',
    reason: 'Risk score exceeds blocking threshold',
  };
}

/**
 * Get risk level label for display
 */
export function getRiskLevel(riskScore: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
} {
  if (riskScore < 0.3) {
    return { level: 'low', color: 'green' };
  }
  if (riskScore < 0.6) {
    return { level: 'medium', color: 'yellow' };
  }
  if (riskScore < 0.95) {
    return { level: 'high', color: 'orange' };
  }
  return { level: 'critical', color: 'red' };
}
