export interface RelayClientConfig {
  baseUrl: string;
  apiKey: string;
  agentId: string;
  autoChain?: boolean;
  timeout?: number;
}

export interface ExecutionOptions {
  parentId?: string;
  timeout?: number;
}

export type ExecutionStatus =
  | 'executed'
  | 'pending_approval'
  | 'blocked'
  | 'failed';

export interface ExecutionResult {
  status: ExecutionStatus;
  executionId?: string;
  requestId?: string;
  output?: any;
  reason?: string;
  error?: string;
}

export interface WaitForApprovalOptions {
  pollInterval?: number;
  timeout?: number;
  onStatusChange?: (status: string) => void;
}

export class BreakerError extends Error {
  constructor(
    message: string,
    public reason: string
  ) {
    super(message);
    this.name = 'BreakerError';
  }
}

export class ApprovalRequiredError extends Error {
  constructor(
    message: string,
    public executionId: string,
    public requestId: string
  ) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

export class ExecutionFailedError extends Error {
  constructor(
    message: string,
    public executionId?: string
  ) {
    super(message);
    this.name = 'ExecutionFailedError';
  }
}
