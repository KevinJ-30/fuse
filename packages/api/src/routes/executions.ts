import { Router, Request, Response } from 'express';
import { ExecutionStatus } from '@prisma/client';
import proxyService from '../services/proxy.service';
import logger from '../utils/logger';

const router = Router();

// GET /api/executions - List executions
router.get('/', async (req: Request, res: Response) => {
  try {
    const { agentId, tool, status, limit } = req.query;

    const executions = await proxyService.listExecutions({
      agentId: agentId as string | undefined,
      tool: tool as string | undefined,
      status: status as ExecutionStatus | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ executions });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error listing executions');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/executions/:id - Get execution details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const execution = await proxyService.getExecution(id);

    if (!execution) {
      return res.status(404).json({
        status: 'error',
        message: 'Execution not found',
      });
    }

    res.json(execution);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error getting execution');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/executions/stats/:timeRange - Get execution statistics
router.get('/stats/:timeRange', async (req: Request, res: Response) => {
  try {
    const { timeRange } = req.params;

    if (!['day', 'week', 'month'].includes(timeRange)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid time range. Must be: day, week, or month',
      });
    }

    const stats = await proxyService.getExecutionStats(timeRange as 'day' | 'week' | 'month');
    res.json(stats);
  } catch (error: any) {
    logger.error({ error: error.message, timeRange: req.params.timeRange }, 'Error getting stats');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/executions/:id/tree - Get execution tree (placeholder for Phase 5)
router.get('/:id/tree', async (req: Request, res: Response) => {
  res.status(501).json({ status: 'error', message: 'Not implemented - coming in Phase 5' });
});

export default router;
