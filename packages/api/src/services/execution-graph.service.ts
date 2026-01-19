import { PrismaClient, Execution } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface ExecutionNode extends Execution {
  children: ExecutionNode[];
}

export class ExecutionGraphService {
  /**
   * Build execution tree from a root execution
   * Returns hierarchical structure with all descendants
   */
  async getExecutionTree(rootId: string): Promise<ExecutionNode | null> {
    try {
      const root = await prisma.execution.findUnique({
        where: { id: rootId },
      });

      if (!root) {
        return null;
      }

      const tree = await this.buildTreeRecursive(root);
      return tree;
    } catch (error: any) {
      logger.error({ error: error.message, rootId }, 'Error getting execution tree');
      throw error;
    }
  }

  /**
   * Recursive helper to build tree structure
   */
  private async buildTreeRecursive(execution: Execution): Promise<ExecutionNode> {
    // Find all children (executions with this as parent)
    const children = await prisma.execution.findMany({
      where: { parentId: execution.id },
      orderBy: { createdAt: 'asc' },
    });

    // Recursively build trees for each child
    const childNodes: ExecutionNode[] = [];
    for (const child of children) {
      const childTree = await this.buildTreeRecursive(child);
      childNodes.push(childTree);
    }

    return {
      ...execution,
      children: childNodes,
    };
  }

  /**
   * Get execution chain (all ancestors)
   * Returns array from oldest ancestor to the specified execution
   */
  async getExecutionChain(executionId: string): Promise<Execution[]> {
    try {
      const chain: Execution[] = [];
      let currentId: string | null = executionId;

      while (currentId) {
        const execution = await prisma.execution.findUnique({
          where: { id: currentId },
        });

        if (!execution) {
          break;
        }

        chain.unshift(execution); // Add to beginning
        currentId = execution.parentId;
      }

      return chain;
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Error getting execution chain');
      throw error;
    }
  }

  /**
   * Get recent executions with optional filters
   */
  async getRecentExecutions(filters?: {
    agentId?: string;
    tool?: string;
    limit?: number;
    includeChildren?: boolean;
  }): Promise<Execution[]> {
    try {
      const where: any = {};

      if (filters?.agentId) {
        where.agentId = filters.agentId;
      }

      if (filters?.tool) {
        where.tool = filters.tool;
      }

      // Only get root executions (no parent) if includeChildren is false
      if (!filters?.includeChildren) {
        where.parentId = null;
      }

      const executions = await prisma.execution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
      });

      return executions;
    } catch (error: any) {
      logger.error({ error: error.message, filters }, 'Error getting recent executions');
      throw error;
    }
  }

  /**
   * Get all descendants of an execution (for blast radius calculation)
   * Uses breadth-first search to collect all child executions
   */
  async getDescendants(executionId: string): Promise<Execution[]> {
    try {
      const descendants: Execution[] = [];
      const queue: string[] = [executionId];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const currentId = queue.shift()!;

        if (visited.has(currentId)) {
          continue;
        }

        visited.add(currentId);

        const execution = await prisma.execution.findUnique({
          where: { id: currentId },
        });

        if (!execution) {
          continue;
        }

        // Don't include the root execution itself
        if (currentId !== executionId) {
          descendants.push(execution);
        }

        // Find children and add to queue
        const children = await prisma.execution.findMany({
          where: { parentId: currentId },
        });

        for (const child of children) {
          queue.push(child.id);
        }
      }

      return descendants;
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Error getting descendants');
      throw error;
    }
  }

  /**
   * Get execution depth in the tree
   * Useful for ordering compensations (deeper executions first)
   */
  async getExecutionDepth(executionId: string): Promise<number> {
    try {
      let depth = 0;
      let currentId: string | null = executionId;

      while (currentId) {
        const execution = await prisma.execution.findUnique({
          where: { id: currentId },
        });

        if (!execution || !execution.parentId) {
          break;
        }

        depth++;
        currentId = execution.parentId;
      }

      return depth;
    } catch (error: any) {
      logger.error({ error: error.message, executionId }, 'Error getting execution depth');
      throw error;
    }
  }

  /**
   * Get executions with depths for sorting
   * Returns executions with their depth in the tree
   */
  async getExecutionsWithDepth(executionIds: string[]): Promise<Array<{ execution: Execution; depth: number }>> {
    try {
      const results = await Promise.all(
        executionIds.map(async (id) => {
          const execution = await prisma.execution.findUnique({ where: { id } });
          if (!execution) {
            return null;
          }
          const depth = await this.getExecutionDepth(id);
          return { execution, depth };
        })
      );

      return results.filter((r) => r !== null) as Array<{ execution: Execution; depth: number }>;
    } catch (error: any) {
      logger.error({ error: error.message, executionIds }, 'Error getting executions with depth');
      throw error;
    }
  }

  /**
   * Count total executions in a tree
   */
  async countTreeNodes(rootId: string): Promise<number> {
    try {
      const descendants = await this.getDescendants(rootId);
      return descendants.length + 1; // +1 for root itself
    } catch (error: any) {
      logger.error({ error: error.message, rootId }, 'Error counting tree nodes');
      throw error;
    }
  }
}

export default new ExecutionGraphService();
