import { Router, Request, Response } from 'express';
import { PolicyAction } from '@prisma/client';
import policyService from '../services/policy.service';
import logger from '../utils/logger';
import { io } from '../server';

const router = Router();

// GET /api/policies - List all policies
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tool, enabled } = req.query;

    const policies = await policyService.listPolicies({
      tool: tool as string | undefined,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    });

    res.json({ policies });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error listing policies');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/policies/:id - Get policy by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const policy = await policyService.getPolicy(id);

    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found',
      });
    }

    res.json(policy);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error getting policy');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// POST /api/policies - Create new policy
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, tool, condition, action, priority } = req.body;

    // Validation
    if (!name || !tool || !action) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: name, tool, action',
      });
    }

    if (!Object.values(PolicyAction).includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid action. Must be one of: ${Object.values(PolicyAction).join(', ')}`,
      });
    }

    const policy = await policyService.createPolicy({
      name,
      tool,
      condition: condition || undefined,
      action,
      priority: priority || 100,
    });

    logger.info({ policyId: policy.id, name: policy.name }, 'Policy created via API');

    // Emit socket event
    io.emit('policy:created', { policy });

    res.status(201).json({ policy });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error creating policy');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// PUT /api/policies/:id - Update policy
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, tool, condition, action, enabled, priority } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (tool !== undefined) updateData.tool = tool;
    if (condition !== undefined) updateData.condition = condition;
    if (action !== undefined) {
      if (!Object.values(PolicyAction).includes(action)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid action. Must be one of: ${Object.values(PolicyAction).join(', ')}`,
        });
      }
      updateData.action = action;
    }
    if (enabled !== undefined) updateData.enabled = enabled;
    if (priority !== undefined) updateData.priority = priority;

    const policy = await policyService.updatePolicy(id, updateData);

    logger.info({ policyId: policy.id, name: policy.name }, 'Policy updated via API');

    // Emit socket event
    io.emit('policy:updated', { policy });

    res.json({ policy });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error updating policy');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// PATCH /api/policies/:id/toggle - Enable/disable policy
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'enabled must be a boolean',
      });
    }

    const policy = await policyService.togglePolicy(id, enabled);

    logger.info({ policyId: policy.id, enabled }, 'Policy toggled via API');

    // Emit socket event
    io.emit('policy:toggled', { policy });

    res.json({ policy });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error toggling policy');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// DELETE /api/policies/:id - Delete policy
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    await policyService.deletePolicy(id);

    logger.info({ policyId: id }, 'Policy deleted via API');

    // Emit socket event
    io.emit('policy:deleted', { policyId: id });

    res.json({ status: 'success', message: 'Policy deleted' });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error deleting policy');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
