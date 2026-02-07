import { Router, Request, Response } from 'express';
import { ApprovalStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import proxyService from '../services/proxy.service';
import logger from '../utils/logger';
import { io } from '../server';

const router = Router();

// GET /api/approvals - List approval requests
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING', limit } = req.query;

    const approvals = await prisma.approvalRequest.findMany({
      where: {
        status: status as ApprovalStatus,
      },
      include: {
        execution: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit as string) : 50,
    });

    res.json({ approvals });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error listing approvals');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// GET /api/approvals/:id - Get approval details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        execution: true,
      },
    });

    if (!approval) {
      return res.status(404).json({
        status: 'error',
        message: 'Approval request not found',
      });
    }

    res.json(approval);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error getting approval');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// POST /api/approvals/:id/approve - Approve and execute
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { modifiedInput, reviewedBy, comments } = req.body;

    // Get approval request
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { execution: true },
    });

    if (!approval) {
      return res.status(404).json({
        status: 'error',
        message: 'Approval request not found',
      });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({
        status: 'error',
        message: `Approval request is not pending (status: ${approval.status})`,
      });
    }

    // Check if expired
    if (approval.expiresAt && new Date() > approval.expiresAt) {
      // Mark as expired
      await prisma.approvalRequest.update({
        where: { id },
        data: {
          status: 'EXPIRED',
          reviewedAt: new Date(),
        },
      });

      return res.status(400).json({
        status: 'error',
        message: 'Approval request has expired',
      });
    }

    logger.info(
      {
        approvalId: id,
        executionId: approval.executionId,
        reviewedBy,
        inputModified: !!modifiedInput,
      },
      'Approving execution'
    );

    // Update approval request
    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewedBy || 'unknown',
        reviewedAt: new Date(),
        decision: 'APPROVED',
        comments: comments || null,
      },
    });

    // Execute the approved request
    const result = await proxyService.executeApproved(
      approval.executionId,
      modifiedInput
    );

    // Emit socket event
    io.emit('approval:resolved', {
      requestId: id,
      executionId: approval.executionId,
      decision: 'APPROVED',
      result,
    });

    res.json({
      status: 'success',
      approval: { id, decision: 'APPROVED' },
      execution: result,
    });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error approving request');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// POST /api/approvals/:id/deny - Deny execution
router.post('/:id/deny', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reviewedBy, comments } = req.body;

    // Get approval request
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { execution: true },
    });

    if (!approval) {
      return res.status(404).json({
        status: 'error',
        message: 'Approval request not found',
      });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({
        status: 'error',
        message: `Approval request is not pending (status: ${approval.status})`,
      });
    }

    logger.info(
      {
        approvalId: id,
        executionId: approval.executionId,
        reviewedBy,
      },
      'Denying execution'
    );

    // Update approval request
    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
        reviewedBy: reviewedBy || 'unknown',
        reviewedAt: new Date(),
        decision: 'DENIED',
        comments: comments || null,
      },
    });

    // Update execution to BLOCKED
    await prisma.execution.update({
      where: { id: approval.executionId },
      data: {
        status: 'BLOCKED',
        completedAt: new Date(),
      },
    });

    // Emit socket event
    io.emit('approval:resolved', {
      requestId: id,
      executionId: approval.executionId,
      decision: 'DENIED',
    });

    res.json({
      status: 'success',
      approval: { id, decision: 'DENIED' },
    });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Error denying request');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
