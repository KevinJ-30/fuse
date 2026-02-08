import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import './ExecutionNode.css';

export interface ExecutionNodeData {
  agentId: string;
  tool: string;
  status: string;
  riskScore?: number;
  createdAt: string;
  onClick?: () => void;
}

function getRiskLevel(score: number): string {
  if (score >= 0.95) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function getStatusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'EXECUTED') return 'completed';
  if (s === 'FAILED') return 'failed';
  if (s === 'BLOCKED') return 'blocked';
  if (s === 'PENDING') return 'pending';
  if (s === 'EXECUTING') return 'executing';
  if (s === 'AWAITING_APPROVAL') return 'awaiting_approval';
  if (s === 'ROLLED_BACK') return 'rolled_back';
  return 'pending';
}

function getNodeBorderClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'EXECUTED') return 'status-completed';
  if (s === 'FAILED' || s === 'BLOCKED') return 'status-failed';
  if (s === 'PENDING' || s === 'AWAITING_APPROVAL') return 'status-pending';
  if (s === 'EXECUTING') return 'status-executing';
  if (s === 'ROLLED_BACK') return 'status-rolled-back';
  return '';
}

function ExecutionNodeComponent({ data }: NodeProps<ExecutionNodeData>) {
  const statusClass = getStatusClass(data.status);
  const borderClass = getNodeBorderClass(data.status);

  return (
    <>
      <Handle type="target" position={Position.Top} className="node-handle" />
      <div
        className={`execution-node ${borderClass}`}
        onClick={data.onClick}
      >
        <div className="node-header">
          <span className="node-agent-id" title={data.agentId}>
            {data.agentId}
          </span>
          <span className={`node-status-badge ${statusClass}`}>
            {data.status.replace(/_/g, ' ')}
          </span>
        </div>
        
        <div className="node-tool" title={data.tool}>{data.tool}</div>
        
        <div className="node-footer">
          <span className="node-time">
            {new Date(data.createdAt).toLocaleTimeString()}
          </span>
          {data.riskScore !== undefined && data.riskScore !== null && (
            <span className={`node-risk risk-${getRiskLevel(data.riskScore)}`}>
              {data.riskScore.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </>
  );
}

export default memo(ExecutionNodeComponent);
