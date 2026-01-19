import axios, { AxiosInstance } from 'axios';
import {
  RelayClientConfig,
  ExecutionOptions,
  ExecutionResult,
  WaitForApprovalOptions,
  BreakerError,
  ApprovalRequiredError,
  ExecutionFailedError,
} from './types';

export class RelayClient {
  private client: AxiosInstance;
  private config: RelayClientConfig;
  private lastExecutionId?: string;

  constructor(config: RelayClientConfig) {
    this.config = {
      timeout: 30000,
      autoChain: false,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
    });
  }

  /**
   * Execute a tool through the Relay proxy
   */
  async execute(
    tool: string,
    input: any,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const parentId =
      options.parentId ||
      (this.config.autoChain ? this.lastExecutionId : undefined);

    try {
      const response = await this.client.post('/api/proxy/execute', {
        agentId: this.config.agentId,
        tool,
        input,
        parentId,
      });

      const result: ExecutionResult = response.data;

      // Store execution ID for auto-chaining
      if (result.executionId) {
        this.lastExecutionId = result.executionId;
      }

      // Handle different response statuses
      if (result.status === 'blocked') {
        throw new BreakerError(
          `Execution blocked: ${result.reason}`,
          result.reason || 'Unknown reason'
        );
      }

      if (result.status === 'pending_approval') {
        throw new ApprovalRequiredError(
          'Execution requires human approval',
          result.executionId!,
          result.requestId!
        );
      }

      if (result.status === 'failed') {
        throw new ExecutionFailedError(
          `Execution failed: ${result.error}`,
          result.executionId
        );
      }

      return result;
    } catch (error: any) {
      if (error instanceof BreakerError ||
          error instanceof ApprovalRequiredError ||
          error instanceof ExecutionFailedError) {
        throw error;
      }

      // Handle network and other errors
      if (error.response) {
        const { status, data } = error.response;
        if (status === 403) {
          throw new BreakerError(
            data.message || 'Execution blocked',
            data.reason || 'Unknown reason'
          );
        }
        throw new ExecutionFailedError(
          data.message || 'Execution failed',
          data.executionId
        );
      }

      throw new ExecutionFailedError(error.message);
    }
  }

  /**
   * Wait for an approval to be resolved
   */
  async waitForApproval(
    executionId: string,
    options: WaitForApprovalOptions = {}
  ): Promise<ExecutionResult> {
    const pollInterval = options.pollInterval || 2000; // 2 seconds
    const timeout = options.timeout || 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.client.get(
          `/api/executions/${executionId}`
        );
        const execution = response.data;

        if (execution.status === 'COMPLETED') {
          return {
            status: 'executed',
            executionId: execution.id,
            output: execution.output,
          };
        }

        if (execution.status === 'BLOCKED') {
          return {
            status: 'blocked',
            executionId: execution.id,
            reason: 'Approval was denied',
          };
        }

        if (execution.status === 'FAILED') {
          return {
            status: 'failed',
            executionId: execution.id,
            error: execution.error,
          };
        }

        // Still waiting, sleep and try again
        await this.sleep(pollInterval);
      } catch (error: any) {
        throw new ExecutionFailedError(
          `Failed to check approval status: ${error.message}`,
          executionId
        );
      }
    }

    throw new ExecutionFailedError(
      'Timeout waiting for approval',
      executionId
    );
  }

  /**
   * Reset the auto-chaining execution ID
   */
  resetChain(): void {
    this.lastExecutionId = undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
