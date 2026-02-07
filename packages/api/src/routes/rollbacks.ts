import { Router, Request, Response } from 'express';
import rollbackService from '../services/rollback.service';
import blastRadiusService from '../services/blast-radius.service';
import compensationService from '../services/compensation.service';
import { getIO } from '../socket';

const router = Router();

/**
 * POST /api/rollbacks
 * Initiate a rollback
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { executionId, strategy, dryRun, autoApprove, reviewedBy, reason } = req.body;

    if (!executionId) {
      return res.status(400).json({ status: 'error', message: 'executionId is required' });
    }

    const result = await rollbackService.rollback(executionId, {
      strategy: strategy || 'SINGLE',
      dryRun: dryRun || false,
      autoApprove: autoApprove || false,
      reviewedBy: reviewedBy || 'unknown',
      reason: reason || 'Manual rollback',
    });

    const io = getIO();
    io.emit('rollback:completed', {
      rollbackId: result.rollbackId,
      executionId,
      status: result.status,
    });

    res.json({ status: 'success', rollback: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/rollbacks - List rollback history
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { executionId, limit } = req.query;

    const rollbacks = await rollbackService.getRollbackHistory({
      executionId: executionId as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ rollbacks });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/rollbacks/stats - Get rollback statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await rollbackService.getRollbackStats();
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/rollbacks/:id - Get rollback details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const rollback = await rollbackService.getRollbackDetails(id);

    if (!rollback) {
      return res.status(404).json({ status: 'error', message: 'Rollback not found' });
    }

    res.json({ rollback });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/rollbacks/preview - Preview blast radius before rollback
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.body;

    if (!executionId) {
      return res.status(400).json({ status: 'error', message: 'executionId is required' });
    }

    const blastRadius = await blastRadiusService.calculateBlastRadius(executionId);
    const summary = blastRadiusService.getSummary(blastRadius);
    const validation = blastRadiusService.validateForRollback(blastRadius);

    res.json({
      blastRadius: {
        total: blastRadius.affectedCount,
        maxDepth: blastRadius.maxDepth,
        timeSpan: blastRadius.timeSpan,
        summary,
      },
      validation,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/rollbacks/compensation - Generate compensation plan
 */
router.post('/compensation', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.body;

    if (!executionId) {
      return res.status(400).json({ status: 'error', message: 'executionId is required' });
    }

    const compensation = await compensationService.generateCompensation(executionId);

    res.json({ compensation });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/rollbacks/compensation/execute - Execute compensation plan
 */
router.post('/compensation/execute', async (req: Request, res: Response) => {
  try {
    const { executionId, planIndex, dryRun, modifiedInput } = req.body;

    if (!executionId) {
      return res.status(400).json({ status: 'error', message: 'executionId is required' });
    }

    const result = await compensationService.executeCompensation(
      executionId,
      planIndex || 0,
      { dryRun: dryRun || false, modifiedInput }
    );

    res.json({ result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
