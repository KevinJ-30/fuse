import { Router, Request, Response } from 'express';
import proxyService from '../services/proxy.service';
import logger from '../utils/logger';

const router = Router();

/**
 * Main proxy endpoint - all tool calls from agents flow through here
 * POST /api/proxy/execute
 *
 * Request body:
 * {
 *   agentId: string - ID of the agent making the call
 *   tool: string - Name of the tool to execute
 *   input: any - Input parameters for the tool
 *   parentId?: string - Optional parent execution ID for DAG tracking
 * }
 *
 * Response:
 * {
 *   status: 'executed' | 'pending_approval' | 'blocked' | 'failed'
 *   executionId: string
 *   output?: any - Tool output (if executed)
 *   reason?: string - Reason (if blocked)
 *   error?: string - Error message (if failed)
 *   requestId?: string - Approval request ID (if pending approval)
 * }
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { agentId, tool, input, parentId } = req.body;

    // Validate required fields
    if (!agentId || !tool || input === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: agentId, tool, input'
      });
    }

    logger.info({ agentId, tool, parentId }, 'Proxy execute request received');

    // Execute through proxy service
    const result = await proxyService.execute({
      agentId,
      tool,
      input,
      parentId,
    });

    // Map status to HTTP status code
    const httpStatus =
      result.status === 'executed' ? 200 :
      result.status === 'pending_approval' ? 202 :
      result.status === 'blocked' ? 403 :
      500; // failed

    return res.status(httpStatus).json(result);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Proxy execute error');
    return res.status(500).json({
      status: 'failed',
      error: error.message
    });
  }
});

export default router;
