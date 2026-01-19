import { PrismaClient, Breaker, BreakerScope, BreakerStatus } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface BreakerCheck {
  isBlocked: boolean;
  reason?: string;
  breaker?: Breaker;
}

export interface CreateBreakerInput {
  scope: BreakerScope;
  target?: string | null;
  reason: string;
}

export class BreakerService {
  /**
   * Check if a tool call should be blocked by any active breakers
   * Performance target: <10ms
   */
  async checkBreakers(agentId: string, tool: string): Promise<BreakerCheck> {
    const startTime = Date.now();

    try {
      // Query all active breakers that could affect this call
      const breakers = await prisma.breaker.findMany({
        where: {
          status: BreakerStatus.ACTIVE,
          OR: [
            // Global breaker (blocks everything)
            { scope: BreakerScope.GLOBAL, target: null },
            // Agent-specific breaker
            { scope: BreakerScope.AGENT, target: agentId },
            // Tool-specific breaker
            { scope: BreakerScope.TOOL, target: tool },
          ],
        },
        orderBy: [
          // Global breakers have highest priority
          { scope: 'asc' },
          { createdAt: 'desc' },
        ],
        take: 1, // We only need to know if ANY breaker is active
      });

      const duration = Date.now() - startTime;

      if (breakers.length > 0) {
        const breaker = breakers[0];
        logger.info(
          { agentId, tool, breaker: breaker.id, scope: breaker.scope, duration },
          'Tool call blocked by breaker'
        );

        return {
          isBlocked: true,
          reason: breaker.reason,
          breaker,
        };
      }

      logger.debug(
        { agentId, tool, duration },
        'No active breakers found'
      );

      return { isBlocked: false };
    } catch (error: any) {
      logger.error({ error: error.message, agentId, tool }, 'Error checking breakers');
      // On error, fail open (allow the call) to prevent complete system failure
      return { isBlocked: false };
    }
  }

  /**
   * Create a new circuit breaker
   */
  async createBreaker(input: CreateBreakerInput): Promise<Breaker> {
    try {
      // Validate target is null for GLOBAL scope
      if (input.scope === BreakerScope.GLOBAL && input.target !== null) {
        throw new Error('Global breakers cannot have a target');
      }

      // Validate target is provided for AGENT and TOOL scopes
      if (input.scope !== BreakerScope.GLOBAL && !input.target) {
        throw new Error(`${input.scope} breakers must have a target`);
      }

      const breaker = await prisma.breaker.create({
        data: {
          scope: input.scope,
          target: input.target || null,
          reason: input.reason,
          status: BreakerStatus.ACTIVE, // New breakers are active by default
        },
      });

      logger.info(
        { breaker: breaker.id, scope: breaker.scope, target: breaker.target },
        'Breaker created'
      );

      return breaker;
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        throw new Error('A breaker with this scope and target already exists');
      }
      logger.error({ error: error.message, input }, 'Error creating breaker');
      throw error;
    }
  }

  /**
   * Toggle breaker status (ACTIVE <-> INACTIVE)
   */
  async toggleBreaker(id: string, status: BreakerStatus): Promise<Breaker> {
    try {
      const breaker = await prisma.breaker.update({
        where: { id },
        data: { status },
      });

      logger.info(
        { breaker: breaker.id, scope: breaker.scope, target: breaker.target, status },
        'Breaker status toggled'
      );

      return breaker;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Breaker not found');
      }
      logger.error({ error: error.message, id, status }, 'Error toggling breaker');
      throw error;
    }
  }

  /**
   * List all breakers (active and inactive)
   */
  async listBreakers(): Promise<Breaker[]> {
    try {
      const breakers = await prisma.breaker.findMany({
        orderBy: [
          { status: 'desc' }, // Active first
          { scope: 'asc' },   // Global, then Agent, then Tool
          { createdAt: 'desc' },
        ],
      });

      return breakers;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error listing breakers');
      throw error;
    }
  }

  /**
   * Get a single breaker by ID
   */
  async getBreaker(id: string): Promise<Breaker | null> {
    try {
      return await prisma.breaker.findUnique({
        where: { id },
      });
    } catch (error: any) {
      logger.error({ error: error.message, id }, 'Error getting breaker');
      throw error;
    }
  }

  /**
   * Delete a breaker
   */
  async deleteBreaker(id: string): Promise<void> {
    try {
      await prisma.breaker.delete({
        where: { id },
      });

      logger.info({ breaker: id }, 'Breaker deleted');
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Breaker not found');
      }
      logger.error({ error: error.message, id }, 'Error deleting breaker');
      throw error;
    }
  }

  /**
   * Get count of active breakers by scope
   */
  async getActiveBreakerCounts(): Promise<{
    global: number;
    agent: number;
    tool: number;
    total: number;
  }> {
    try {
      const [global, agent, tool] = await Promise.all([
        prisma.breaker.count({
          where: { status: BreakerStatus.ACTIVE, scope: BreakerScope.GLOBAL },
        }),
        prisma.breaker.count({
          where: { status: BreakerStatus.ACTIVE, scope: BreakerScope.AGENT },
        }),
        prisma.breaker.count({
          where: { status: BreakerStatus.ACTIVE, scope: BreakerScope.TOOL },
        }),
      ]);

      return {
        global,
        agent,
        tool,
        total: global + agent + tool,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting breaker counts');
      throw error;
    }
  }
}

export default new BreakerService();
