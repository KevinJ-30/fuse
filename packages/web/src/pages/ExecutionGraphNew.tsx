import { useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Panel as FlowPanel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import apiClient from '../lib/api';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import ExecutionNode from '../components/graph/ExecutionNode';
import { useGraphLayout } from '../components/graph/useGraphLayout';
import '../styles/tokens.css';
import './ExecutionGraphNew.css';

interface Execution {
  id: string;
  agentId: string;
  tool: string;
  status: string;
  createdAt: string;
  parentId: string | null;
  riskScore?: number;
  input?: any;
  output?: any;
}

const nodeTypes = {
  custom: ExecutionNode,
};

export default function ExecutionGraphNew() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      const response = await apiClient.get('/api/executions');
      setExecutions(response.data.executions || []);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const nodes: Node[] = executions.map((exec) => ({
    id: exec.id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      agentId: exec.agentId,
      tool: exec.tool,
      status: exec.status,
      riskScore: exec.riskScore,
      createdAt: exec.createdAt,
    },
  }));

  const edges: Edge[] = executions
    .filter(exec => exec.parentId)
    .map(exec => ({
      id: `${exec.parentId}-${exec.id}`,
      source: exec.parentId!,
      target: exec.id,
      type: 'smoothstep',
      animated: exec.status === 'EXECUTING' || exec.status === 'PENDING',
    }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(nodes, edges, 'TB');

  if (loading) {
    return (
      <div className="execution-graph-container">
        <div className="loading-state">Loading executions...</div>
      </div>
    );
  }

  return (
    <div className="execution-graph-container">
      <div className="execution-header animate-in">
        <h1 className="heading heading-lg">Execution Graph</h1>
        <p className="execution-subtitle">Visual execution flow and relationships</p>
      </div>

      {executions.length === 0 ? (
        <Panel className="animate-in stagger-1">
          <div className="empty-state">
            <h3>No executions found</h3>
            <p>Executions will appear here once agents start running</p>
          </div>
        </Panel>
      ) : (
        <div className="graph-wrapper">
          <ReactFlow
            nodes={layoutedNodes}
            edges={layoutedEdges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background />
            <Controls />
            <MiniMap />
            <FlowPanel position="top-left">
              <div className="graph-legend">
                <Badge variant="success" size="sm">Completed</Badge>
                <Badge variant="warning" size="sm">Pending</Badge>
                <Badge variant="danger" size="sm">Blocked</Badge>
              </div>
            </FlowPanel>
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
