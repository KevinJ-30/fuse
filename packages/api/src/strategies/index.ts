import { Execution } from '@prisma/client';

export type CompensationType =
  | 'AUTO_REVERSE'
  | 'SUGGESTED'
  | 'MANUAL_REQUIRED'
  | 'NOT_REVERSIBLE'
  | 'NO_ACTION_NEEDED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CompensationPlan {
  type: CompensationType;
  tool: string;
  input: any;
  description: string;
  riskLevel: RiskLevel;
  reasoning?: string;
}

export interface CompensationStrategy {
  /**
   * Check if this strategy supports the given tool
   */
  supports(tool: string): boolean;

  /**
   * Generate compensation plan(s) for an execution
   * May return multiple compensations for complex operations
   */
  generate(execution: Execution): Promise<CompensationPlan[]>;
}

// Strategy registry
const strategies = new Map<string, CompensationStrategy>();

/**
 * Register a compensation strategy for a tool or pattern
 */
export function registerStrategy(pattern: string, strategy: CompensationStrategy): void {
  strategies.set(pattern, strategy);
}

/**
 * Get strategy for a tool
 * Supports exact match or prefix match (e.g., "slack_" matches all slack tools)
 */
export function getStrategy(tool: string): CompensationStrategy | undefined {
  // Try exact match first
  if (strategies.has(tool)) {
    return strategies.get(tool);
  }

  // Try prefix match
  for (const [pattern, strategy] of strategies.entries()) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (tool.startsWith(prefix)) {
        return strategy;
      }
    }
  }

  return undefined;
}

/**
 * Check if a tool has a compensation strategy
 */
export function hasStrategy(tool: string): boolean {
  return getStrategy(tool) !== undefined;
}

/**
 * Get all registered strategies
 */
export function getAllStrategies(): Map<string, CompensationStrategy> {
  return new Map(strategies);
}
