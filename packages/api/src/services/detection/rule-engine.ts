import { PrismaClient, Rule, RuleType, RuleSeverity } from '@prisma/client';
import logger from '../../utils/logger';
import {
  RuleViolation,
  RateLimitConfig,
  ValueThresholdConfig,
  PatternMatchConfig,
  TimeRestrictionConfig,
  ProtectedResourceConfig,
} from './types';

const prisma = new PrismaClient();

export class RuleEngine {
  private rulesCache: Rule[] = [];
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Run rule-based detection on a tool call
   * Performance target: <10ms per rule
   */
  async analyze(agentId: string, tool: string, input: any): Promise<RuleViolation[]> {
    const startTime = Date.now();
    const violations: RuleViolation[] = [];

    try {
      // Get applicable rules
      const rules = await this.getRules();
      const applicableRules = rules.filter(
        (rule) => rule.enabled && this.isRuleApplicable(rule, tool)
      );

      // Check each rule
      for (const rule of applicableRules) {
        const violation = await this.checkRule(rule, agentId, tool, input);
        if (violation) {
          violations.push(violation);
        }
      }

      const duration = Date.now() - startTime;
      logger.debug(
        { agentId, tool, violations: violations.length, duration },
        'Rule engine analysis complete'
      );

      return violations;
    } catch (error: any) {
      logger.error({ error: error.message, agentId, tool }, 'Error in rule engine');
      return violations; // Return partial results on error
    }
  }

  /**
   * Check if a rule applies to this tool
   */
  private isRuleApplicable(rule: Rule, tool: string): boolean {
    const config = rule.config as any;
    return !config.tool || config.tool === tool;
  }

  /**
   * Check a single rule against the execution
   */
  private async checkRule(
    rule: Rule,
    agentId: string,
    tool: string,
    input: any
  ): Promise<RuleViolation | null> {
    try {
      switch (rule.type) {
        case RuleType.RATE_LIMIT:
          return await this.checkRateLimit(rule, agentId, tool);
        case RuleType.VALUE_THRESHOLD:
          return this.checkValueThreshold(rule, input);
        case RuleType.PATTERN_MATCH:
          return this.checkPatternMatch(rule, input);
        case RuleType.TIME_RESTRICTION:
          return this.checkTimeRestriction(rule);
        case RuleType.PROTECTED_RESOURCE:
          return this.checkProtectedResource(rule, input);
        default:
          return null;
      }
    } catch (error: any) {
      logger.error(
        { error: error.message, ruleId: rule.id, type: rule.type },
        'Error checking rule'
      );
      return null;
    }
  }

  /**
   * Check rate limit rule
   */
  private async checkRateLimit(
    rule: Rule,
    agentId: string,
    tool: string
  ): Promise<RuleViolation | null> {
    const config = rule.config as RateLimitConfig;
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

    const where: any = {
      tool: config.tool,
      createdAt: { gte: windowStart },
    };

    // If rule specifies agentId, check only that agent
    // Otherwise check the current agent
    if (config.agentId) {
      where.agentId = config.agentId;
    } else {
      where.agentId = agentId;
    }

    const count = await prisma.execution.count({ where });

    if (count >= config.limit) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity,
        matched: true,
        message: `Rate limit exceeded: ${count}/${config.limit} calls in ${config.windowMinutes} minutes`,
        details: { count, limit: config.limit, window: config.windowMinutes },
      };
    }

    return null;
  }

  /**
   * Check value threshold rule
   */
  private checkValueThreshold(rule: Rule, input: any): RuleViolation | null {
    const config = rule.config as ValueThresholdConfig;
    const value = this.getFieldValue(input, config.field);

    if (value === undefined || value === null) {
      return null;
    }

    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) {
      return null;
    }

    let matched = false;
    switch (config.operator) {
      case 'gt':
        matched = numValue > config.threshold;
        break;
      case 'lt':
        matched = numValue < config.threshold;
        break;
      case 'gte':
        matched = numValue >= config.threshold;
        break;
      case 'lte':
        matched = numValue <= config.threshold;
        break;
      case 'eq':
        matched = numValue === config.threshold;
        break;
      case 'neq':
        matched = numValue !== config.threshold;
        break;
    }

    if (matched) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity,
        matched: true,
        message: `Value threshold violated: ${config.field} ${config.operator} ${config.threshold} (value: ${numValue})`,
        details: { field: config.field, value: numValue, threshold: config.threshold },
      };
    }

    return null;
  }

  /**
   * Check pattern match rule
   */
  private checkPatternMatch(rule: Rule, input: any): RuleViolation | null {
    const config = rule.config as PatternMatchConfig;
    const pattern = new RegExp(config.pattern);

    let textToCheck: string;
    if (config.field) {
      const fieldValue = this.getFieldValue(input, config.field);
      textToCheck = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
    } else {
      textToCheck = JSON.stringify(input);
    }

    if (pattern.test(textToCheck)) {
      const match = textToCheck.match(pattern);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity,
        matched: true,
        message: `Pattern matched: ${config.description}`,
        details: { pattern: config.pattern, match: match?.[0] },
      };
    }

    return null;
  }

  /**
   * Check time restriction rule
   */
  private checkTimeRestriction(rule: Rule): RuleViolation | null {
    const config = rule.config as TimeRestrictionConfig;
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Check day of week
    if (!config.allowedDays.includes(day)) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity,
        matched: true,
        message: `Time restriction: Not allowed on this day (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]})`,
        details: { currentDay: day, allowedDays: config.allowedDays },
      };
    }

    // Check hour of day
    const [startHour, endHour] = config.allowedHours;
    if (hour < startHour || hour >= endHour) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity,
        matched: true,
        message: `Time restriction: Not allowed at this hour (${hour}:00)`,
        details: { currentHour: hour, allowedHours: config.allowedHours },
      };
    }

    return null;
  }

  /**
   * Check protected resource rule
   */
  private checkProtectedResource(rule: Rule, input: any): RuleViolation | null {
    const config = rule.config as ProtectedResourceConfig;
    const inputString = JSON.stringify(input);

    for (const patternStr of config.protectedPatterns) {
      const pattern = new RegExp(patternStr);
      if (pattern.test(inputString)) {
        const match = inputString.match(pattern);
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          type: rule.type,
          severity: rule.severity,
          matched: true,
          message: `Protected resource access detected: ${match?.[0]}`,
          details: { pattern: patternStr, match: match?.[0] },
        };
      }
    }

    return null;
  }

  /**
   * Get field value from input using dot notation
   * e.g., "user.email" or "amount"
   */
  private getFieldValue(input: any, field: string): any {
    const parts = field.split('.');
    let value = input;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Get rules with caching
   */
  private async getRules(): Promise<Rule[]> {
    const now = Date.now();
    if (this.rulesCache.length > 0 && now - this.lastCacheUpdate < this.CACHE_TTL) {
      return this.rulesCache;
    }

    this.rulesCache = await prisma.rule.findMany({
      where: { enabled: true },
    });
    this.lastCacheUpdate = now;

    return this.rulesCache;
  }

  /**
   * Clear the rules cache (useful after adding/updating rules)
   */
  clearCache(): void {
    this.rulesCache = [];
    this.lastCacheUpdate = 0;
  }
}

export default new RuleEngine();
