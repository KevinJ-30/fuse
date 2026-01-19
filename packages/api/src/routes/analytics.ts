import { Router, Request, Response } from 'express';
import { ExecutionStatus, BreakerStatus, RuleSeverity } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';

const router = Router();

// GET /api/analytics/dashboard - Dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;

    // Calculate time threshold
    const now = new Date();
    const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720; // 24h, 7d, 30d
    const since = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    // Executions in time range
    const executionsCount = await prisma.execution.count({
      where: { createdAt: { gte: since } },
    });

    // Executions by status
    const executionsByStatus = await prisma.execution.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });

    // Risk score distribution
    const executionsWithRisk = await prisma.execution.findMany({
      where: {
        createdAt: { gte: since },
        riskScore: { not: null },
      },
      select: { riskScore: true },
    });

    const riskDistribution = {
      low: executionsWithRisk.filter((e) => e.riskScore! < 0.3).length,
      medium: executionsWithRisk.filter((e) => e.riskScore! >= 0.3 && e.riskScore! < 0.6).length,
      high: executionsWithRisk.filter((e) => e.riskScore! >= 0.6 && e.riskScore! <= 0.95).length,
      critical: executionsWithRisk.filter((e) => e.riskScore! > 0.95).length,
    };

    // Active breakers
    const activeBreakersCount = await prisma.breaker.count({
      where: { status: BreakerStatus.ACTIVE },
    });

    // Approval stats
    const totalApprovals = await prisma.approvalRequest.count({
      where: { createdAt: { gte: since } },
    });
    const approvedCount = await prisma.approvalRequest.count({
      where: {
        createdAt: { gte: since },
        status: 'APPROVED',
      },
    });
    const approvalRate = totalApprovals > 0 ? Math.round((approvedCount / totalApprovals) * 100) : 0;

    // Recent rollbacks
    const recentRollbacksCount = await prisma.rollback.count({
      where: { createdAt: { gte: since } },
    });

    // Top agents by execution count
    const topAgents = await prisma.execution.groupBy({
      by: ['agentId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Top tools by execution count
    const topTools = await prisma.execution.groupBy({
      by: ['tool'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Detection stats: executions with rule violations
    const executionsWithDetection = await prisma.execution.findMany({
      where: {
        createdAt: { gte: since },
        detectionFlags: { not: null },
      },
      select: { detectionFlags: true },
    });

    let ruleViolationsCount = 0;
    let anomaliesCount = 0;
    let semanticConcernsCount = 0;

    for (const exec of executionsWithDetection) {
      const flags = exec.detectionFlags as any;
      if (flags?.flags?.hasRuleViolations) ruleViolationsCount++;
      if (flags?.flags?.hasAnomalies) anomaliesCount++;
      if (flags?.flags?.hasSemanticConcerns) semanticConcernsCount++;
    }

    // Average risk score
    const avgRiskScore =
      executionsWithRisk.length > 0
        ? executionsWithRisk.reduce((sum, e) => sum + e.riskScore!, 0) / executionsWithRisk.length
        : 0;

    res.json({
      timeRange,
      executions: {
        total: executionsCount,
        byStatus: executionsByStatus.reduce(
          (acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      riskDistribution,
      avgRiskScore: Math.round(avgRiskScore * 100) / 100,
      detection: {
        ruleViolations: ruleViolationsCount,
        anomalies: anomaliesCount,
        semanticConcerns: semanticConcernsCount,
        detectionRate:
          executionsCount > 0
            ? Math.round((executionsWithDetection.length / executionsCount) * 100)
            : 0,
      },
      activeBreakers: activeBreakersCount,
      approvals: {
        total: totalApprovals,
        approved: approvedCount,
        rate: approvalRate,
      },
      rollbacks: recentRollbacksCount,
      topAgents: topAgents.map((a) => ({ agentId: a.agentId, count: a._count.id })),
      topTools: topTools.map((t) => ({ tool: t.tool, count: t._count.id })),
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error fetching dashboard stats');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/analytics/executions/trend - Execution trend
router.get('/executions/trend', async (req: Request, res: Response) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});

// GET /api/analytics/agents/top - Top agents
router.get('/agents/top', async (req: Request, res: Response) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});

// GET /api/analytics/tools/top - Top tools
router.get('/tools/top', async (req: Request, res: Response) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});

export default router;
