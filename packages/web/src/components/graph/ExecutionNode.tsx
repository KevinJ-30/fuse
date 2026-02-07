import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Badge } from '../ui/Badge';
import './ExecutionNode.css';

export interface ExecutionNodeData {
  agentId: string;
  tool: string;
  status: string;
  riskScore?: number;
  createdAt: string;
  onClick?: () => void;
}

function ExecutionNode({ data }: NodeProps<ExecutionNodeData>) {
  const getStatusColor = (status: string) => {
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'EXECUTED') return '#36d399';
    if (statusUpper === 'PENDING' || statusUpper === 'AWAITING_APPROVAL' || statusUpper === 'RUNNING') return '#fbbd23';
    if (statusUpper === 'BLOCKED' || statusUpper === 'FAILED') return '#dc2626';
    return '#6b7280';
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'EXECUTED') return 'success';
    if (statusUpper === 'PENDING' || statusUpper === 'AWAITING_APPROVAL' || statusUpper === 'RUNNING') return 'warning';
    if (statusUpper === 'BLOCKED' || statusUpper === 'FAILED') return 'danger';
    return 'default';
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="node-handle" />
      <div
        className="execution-node"
        style={{ borderColor: getStatusColor(data.status) }}
        onClick={data.onClick}
      >
        <div className="node-header">
          <Badge variant="brand" size="sm">{data.agentId}</Badge>
          <Badge variant={getStatusVariant(data.status)} size="sm">{data.status}</Badge>
        </div>
        <div className="node-tool">{data.tool}</div>
        <div className="node-footer">
          <div className="node-time">
            {new Date(data.createdAt).toLocaleTimeString()}
          </div>
          {data.riskScore !== undefined && (
            <div className="node-risk">
              Risk: {data.riskScore.toFixed(2)}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </>
  );
}

export default memo(ExecutionNode);
