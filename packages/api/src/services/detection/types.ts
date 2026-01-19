import { RuleSeverity, RuleType } from '@prisma/client';

// ===== Detection Result Types =====

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  type: RuleType;
  severity: RuleSeverity;
  matched: boolean;
  message: string;
  details?: any;
}

export interface AnomalyFlag {
  type: 'volume' | 'timing' | 'target' | 'value' | 'sequence';
  severity: 'moderate' | 'high';
  zScore: number;
  baseline: any;
  current: any;
  message: string;
}

export interface SemanticAnalysis {
  recommendation: 'ALLOW' | 'FLAG_FOR_REVIEW' | 'BLOCK';
  confidence: number; // 0.0 to 1.0
  concerns: string[];
  reasoning: string;
}

export interface DetectionResult {
  rules: RuleViolation[];
  anomalies: AnomalyFlag[];
  semantic?: SemanticAnalysis;
  riskScore: number;
  flags: {
    hasRuleViolations: boolean;
    hasAnomalies: boolean;
    hasSemanticConcerns: boolean;
  };
  layerExecutionTimes: {
    rules: number;
    anomalies: number;
    semantic?: number;
    total: number;
  };
}

// ===== Baseline Types =====

export interface BaselineData {
  agentId: string;
  tool: string;
  dailyCountsMean: number;
  dailyCountsStdDev: number;
  activeHours: Record<number, number>; // hour -> count
  commonTargets: Record<string, number>; // target -> percentage
  transitionProbabilities: Record<string, number>; // nextTool -> probability
}

// ===== Rule Configuration Types =====

export interface RateLimitConfig {
  tool: string;
  agentId?: string;
  limit: number;
  windowMinutes: number;
}

export interface ValueThresholdConfig {
  tool: string;
  field: string; // JSONPath to field
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  threshold: number;
}

export interface PatternMatchConfig {
  tool: string;
  field?: string; // Optional field to check, otherwise checks whole input
  pattern: string; // Regex pattern
  description: string;
}

export interface TimeRestrictionConfig {
  tool: string;
  allowedHours: [number, number]; // [start, end] in 24h format
  allowedDays: number[]; // 0-6 (Sunday-Saturday)
  timezone: string;
}

export interface ProtectedResourceConfig {
  tool: string;
  protectedPatterns: string[]; // Regex patterns for protected paths/resources
}

export type RuleConfig =
  | RateLimitConfig
  | ValueThresholdConfig
  | PatternMatchConfig
  | TimeRestrictionConfig
  | ProtectedResourceConfig;
