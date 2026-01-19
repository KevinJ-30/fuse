import { PrismaClient, ExecutionStatus, PolicyAction } from '@prisma/client';
import logger from '../utils/logger';
import breakerService from './breaker.service';
import toolExecutorService from './tool-executor.service';
import detectionPipeline from './detection/pipeline';
import policyService from './policy.service';
import { determineAction } from '../utils/risk-scorer';
import { io } from '../server';

const prisma = new PrismaClient();

export interface ProxyRequest {
  agentId: string;
  tool: string;
  input: any;
  parentId?: string;
}

export interface ProxyResponse {
  status: 'executed' | 'pending_approval' | 'blocked' | 'failed';
  executionId?: string;
  requestId?: string;
  output?: any;
  reason?: string;
  error?: string;
}

export class ProxyService {
  /**
   * Main proxy execution flow
   * For Phase 2, we implement: breaker checks + execution
   * Detection, policies, and rollbacks will be added in later phases
   */
  async execute(request: ProxyRequest): Promise<ProxyResponse> {
    const { agentId, tool, input, parentId } = request;
    const startTime = Date.now();

    logger.info(
      { agentId, tool, parentId, inputSize: JSON.stringify(input).length },
      'Proxy execution started'
    );

    let executionId: string | undefined;

    try {
      // ===== STEP 1: Check Breakers =====
      // This is the fastest safety check - must complete in <10ms
      const breakerCheck = await breakerService.checkBreakers(agentId, tool);

      if (breakerCheck.isBlocked) {
        logger.warn(
          { agentId, tool, breaker: breakerCheck.breaker?.id, reason: breakerCheck.reason },
          'Execution blocked by breaker'
        );

        // Create execution record with BLOCKED status
        const execution = await prisma.execution.create({
          data: {
            agentId,
            tool,
            input,
            parentId,
            status: ExecutionStatus.BLOCKED,
            startedAt: new Date(),
            completedAt: new Date(),
            detectionFlags: {
              breaker: {
                id: breakerCheck.breaker?.id,
                scope: breakerCheck.breaker?.scope,
                reason: breakerCheck.reason,
              },
            },
          },
        });

        executionId = execution.id;

        // Emit socket event
        io.emit('execution:blocked', { executionId, agentId, tool, reason: breakerCheck.reason });

        return {
          status: 'blocked',
          executionId: execution.id,
          reason: breakerCheck.reason || 'Blocked by circuit breaker',
        };
      }

      // ===== STEP 2: Create Execution Record (PENDING) =====
      const execution = await prisma.execution.create({
        data: {
          agentId,
          tool,
          input,
          parentId,
          status: ExecutionStatus.PENDING,
          startedAt: new Date(),
          // previousState will be captured here in Phase 5 (rollbacks)
          // riskScore will be set in Phase 3 (detection)
        },
      });

      executionId = execution.id;

      logger.info({ executionId, agentId, tool }, 'Execution record created');

      // Emit socket event
      io.emit('execution:new', {
        executionId,
        agentId,
        tool,
        status: 'pending',
      });

      // ===== STEP 3: Run Detection Pipeline =====
      // Phase 3: Detection layer with risk scoring
      const detectionResult = await detectionPipeline.analyze(agentId, tool, input);

      // Update execution with detection results
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          riskScore: detectionResult.riskScore,
          detectionFlags: detectionResult,
        },
      });

      // ===== STEP 4: Evaluate Policies =====
      const policyDecision = await policyService.evaluatePolicies(agentId, tool, input);

      logger.info(
        { executionId, agentId, tool, policyAction: policyDecision.action },
        'Policy evaluation complete'
      );

      // Check if policy forces a specific action
      if (policyDecision.action === PolicyAction.DENY) {
        // Policy explicitly denies this execution
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            status: ExecutionStatus.BLOCKED,
            completedAt: new Date(),
          },
        });

        logger.warn(
          { executionId, agentId, tool, policyId: policyDecision.matchedPolicy?.id },
          'Execution blocked by policy'
        );

        io.emit('execution:blocked', {
          executionId,
          agentId,
          tool,
          reason: policyDecision.reason,
        });

        return {
          status: 'blocked',
          executionId,
          reason: policyDecision.reason || 'Blocked by policy',
        };
      }

      // ===== STEP 5: Determine Action Based on Risk Score and Policy =====
      const { action, reason: actionReason } = determineAction(detectionResult.riskScore);

      // Combine policy decision with risk-based decision
      let requiresApproval = false;

      if (policyDecision.action === PolicyAction.REQUIRE_APPROVAL) {
        requiresApproval = true;
      } else if (action === 'review') {
        requiresApproval = true;
      } else if (action === 'block') {
        // Auto-block due to critical risk score
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            status: ExecutionStatus.BLOCKED,
            completedAt: new Date(),
          },
        });

        logger.warn(
          { executionId, agentId, tool, riskScore: detectionResult.riskScore },
          'Execution auto-blocked by detection'
        );

        io.emit('execution:blocked', {
          executionId,
          agentId,
          tool,
          reason: actionReason,
          riskScore: detectionResult.riskScore,
        });

        return {
          status: 'blocked',
          executionId,
          reason: actionReason,
        };
      }

      // ===== STEP 6: Create Approval Request if Required =====
      if (requiresApproval) {
        await prisma.execution.update({
          where: { id: executionId },
          data: { status: ExecutionStatus.AWAITING_APPROVAL },
        });

        // Calculate expiration (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const approvalRequest = await prisma.approvalRequest.create({
          data: {
            executionId,
            status: 'PENDING',
            riskScore: detectionResult.riskScore,
            riskBreakdown: {
              rules: detectionResult.rules.length,
              anomalies: detectionResult.anomalies.length,
              semantic: detectionResult.semantic ? true : false,
            },
            detectionFlags: detectionResult,
            expiresAt,
          },
        });

        logger.info(
          {
            executionId,
            requestId: approvalRequest.id,
            agentId,
            tool,
            riskScore: detectionResult.riskScore,
          },
          'Approval request created'
        );

        io.emit('approval:new', {
          requestId: approvalRequest.id,
          executionId,
          agentId,
          tool,
          riskScore: detectionResult.riskScore,
        });

        return {
          status: 'pending_approval',
          executionId,
          requestId: approvalRequest.id,
          reason: policyDecision.reason || actionReason,
        };
      }

      // ===== STEP 7: Update to EXECUTING =====
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: ExecutionStatus.EXECUTING },
      });

      // ===== STEP 8: Execute Tool =====
      const toolResult = await toolExecutorService.execute(tool, input);

      if (!toolResult.success) {
        throw new Error(toolResult.error || 'Tool execution failed');
      }

      // ===== STEP 9: Update Execution Record (COMPLETED) =====
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.COMPLETED,
          output: toolResult.output,
          completedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;

      logger.info(
        { executionId, agentId, tool, duration },
        'Execution completed successfully'
      );

      // Emit socket event
      io.emit('execution:completed', {
        executionId,
        agentId,
        tool,
        output: toolResult.output,
        duration,
      });

      return {
        status: 'executed',
        executionId,
        output: toolResult.output,
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack, agentId, tool, executionId },
        'Proxy execution failed'
      );

      // Update execution record if it was created
      if (executionId) {
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            status: ExecutionStatus.FAILED,
            completedAt: new Date(),
            output: { error: error.message },
          },
        }).catch((updateError) => {
          logger.error(
            { error: updateError.message, executionId },
            'Failed to update execution record'
          );
        });

        // Emit socket event
        io.emit('execution:failed', {
          executionId,
          agentId,
          tool,
          error: error.message,
        });
      }

      return {
        status: 'failed',
        executionId,
        error: error.message,
      };
    }
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string) {
    try {
      return await prisma.execution.findUnique({
        where: { id },
      });
    } catch (error: any) {
      logger.error({ error: error.message, id }, 'Error getting execution');
      throw error;
    }
  }

  /**
   * List recent executions
   */
  async listExecutions(filters?: {
    agentId?: string;
    tool?: string;
    status?: ExecutionStatus;
    limit?: number;
  }) {
    try {
      const where: any = {};
      if (filters?.agentId) where.agentId = filters.agentId;
      if (filters?.tool) where.tool = filters.tool;
      if (filters?.status) where.status = filters.status;

      return await prisma.execution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
      });
    } catch (error: any) {
      logger.error({ error: error.message, filters }, 'Error listing executions');
      throw error;
    }
  }

  /**
   * Execute an approved request
   * Called after approval is granted
   */
  async executeApproved(executionId: string, modifiedInput?: any): Promise<ProxyResponse> {
    try {
      // Get the execution record
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        throw new Error('Execution not found');
      }

      if (execution.status !== ExecutionStatus.AWAITING_APPROVAL) {
        throw new Error(`Execution is not awaiting approval (status: ${execution.status})`);
      }

      logger.info({ executionId, agentId: execution.agentId }, 'Executing approved request');

      // Use modified input if provided, otherwise use original
      const inputToExecute = modifiedInput || execution.input;

      // Update input if it was modified
      if (modifiedInput) {
        await prisma.execution.update({
          where: { id: executionId },
          data: { input: modifiedInput },
        });
      }

      // Update to EXECUTING
      await prisma.execution.update({
        where: { id: executionId },
        data: { status: ExecutionStatus.EXECUTING },
      });

      // Execute tool
      const toolResult = await toolExecutorService.execute(execution.tool, inputToExecute);

      if (!toolResult.success) {
        throw new Error(toolResult.error || 'Tool execution failed');
      }

      // Update execution record (COMPLETED)
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.COMPLETED,
          output: toolResult.output,
          completedAt: new Date(),
        },
      });

      logger.info(
        { executionId, agentId: execution.agentId, tool: execution.tool },
        'Approved execution completed successfully'
      );

      // Emit socket event
      io.emit('execution:completed', {
        executionId,
        agentId: execution.agentId,
        tool: execution.tool,
        output: toolResult.output,
      });

      return {
        status: 'executed',
        executionId,
        output: toolResult.output,
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, executionId },
        'Failed to execute approved request'
      );

      // Update execution status to FAILED
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          output: { error: error.message },
        },
      }).catch((updateError) => {
        logger.error(
          { error: updateError.message, executionId },
          'Failed to update execution record'
        );
      });

      return {
        status: 'failed',
        executionId,
        error: error.message,
      };
    }
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(timeRange: 'day' | 'week' | 'month' = 'day') {
    try {
      const now = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(now.getDate() - 30);
          break;
      }

      const [total, completed, failed, blocked] = await Promise.all([
        prisma.execution.count({
          where: { createdAt: { gte: startDate } },
        }),
        prisma.execution.count({
          where: {
            createdAt: { gte: startDate },
            status: ExecutionStatus.COMPLETED,
          },
        }),
        prisma.execution.count({
          where: {
            createdAt: { gte: startDate },
            status: ExecutionStatus.FAILED,
          },
        }),
        prisma.execution.count({
          where: {
            createdAt: { gte: startDate },
            status: ExecutionStatus.BLOCKED,
          },
        }),
      ]);

      return {
        total,
        completed,
        failed,
        blocked,
        successRate: total > 0 ? (completed / total) * 100 : 0,
      };
    } catch (error: any) {
      logger.error({ error: error.message, timeRange }, 'Error getting execution stats');
      throw error;
    }
  }
}

export default new ProxyService();
