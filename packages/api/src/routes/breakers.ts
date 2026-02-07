import { Router, Request, Response } from 'express';
import { BreakerScope, BreakerStatus } from '@prisma/client';
import breakerService from '../services/breaker.service';
import logger from '../utils/logger';
import { io } from '../server';

const router = Router();

// GET /api/breakers - List all breakers
router.get('/', async (req: Request, res: Response) => {
  try {
    const breakers = await breakerService.listBreakers();
    res.json({ breakers });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error listing breakers');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/breakers/counts - Get active breaker counts
router.get('/counts', async (req: Request, res: Response) => {
  try {
    const counts = await breakerService.getActiveBreakerCounts();
    res.json(counts);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error getting breaker counts');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/breakers/:id - Get single breaker
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const breaker = await breakerService.getBreaker(id);

    if (!breaker) {
      return res.status(404).json({
        status: 'error',
        message: 'Breaker not found',
      });
    }

    res.json({ breaker });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error getting breaker');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// POST /api/breakers - Create new breaker
router.post('/', async (req: Request, res: Response) => {
  try {
    const { scope, target, reason } = req.body;

    // Validate required fields
    if (!scope || !reason) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: scope, reason',
      });
    }

    // Validate scope enum
    if (!Object.values(BreakerScope).includes(scope)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid scope. Must be one of: ${Object.values(BreakerScope).join(', ')}`,
      });
    }

    const breaker = await breakerService.createBreaker({
      scope,
      target: target || null,
      reason,
    });

    // Emit socket event
    io.emit('breaker:created', { breaker });

    logger.info({ breaker: breaker.id, scope, target }, 'Breaker created via API');

    res.status(201).json({ breaker });
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body }, 'Error creating breaker');
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
});

// PATCH /api/breakers/:id - Toggle breaker status
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    // Validate status
    if (!status || !Object.values(BreakerStatus).includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status. Must be one of: ${Object.values(BreakerStatus).join(', ')}`,
      });
    }

    const breaker = await breakerService.toggleBreaker(id, status);

    // Emit socket event
    io.emit('breaker:toggled', { breaker });

    logger.info({ breaker: breaker.id, status }, 'Breaker toggled via API');

    res.json({ breaker });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error toggling breaker');

    if (error.message === 'Breaker not found') {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// DELETE /api/breakers/:id - Delete breaker
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    await breakerService.deleteBreaker(id);

    // Emit socket event
    io.emit('breaker:deleted', { breakerId: id });

    logger.info({ breaker: id }, 'Breaker deleted via API');

    res.json({ message: 'Breaker deleted successfully' });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error deleting breaker');

    if (error.message === 'Breaker not found') {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
