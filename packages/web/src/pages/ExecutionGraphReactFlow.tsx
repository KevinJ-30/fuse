import { useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import apiClient from '../lib/api';
import ExecutionNode from '../components/graph/ExecutionNode';
import { useGraphLayout } from '../components/graph/useGraphLayout';

const nodeTypes = { execution: ExecutionNode };

export default function ExecutionGraphReactFlow() {
  const [executions, setExecutions] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get('/api/executions?limit=50');
      setExecutions(res.data.executions || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (executions.length === 0) return;
    
    const newNodes = executions.map(e => ({
      id: e.id,
      type: 'execution',
      position: { x: 0, y: 0 },
      data: {
        agentId: e.agentId,
        tool: e.tool,
        status: e.status,
        createdAt: e.createdAt,
      },
    }));

    const newEdges = executions
      .filter(e => e.parentId)
      .map(e => ({
        id: `${e.parentId}-${e.id}`,
        source: e.parentId,
        target: e.id,
        type: 'smoothstep',
      }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [executions]);

  const { nodes: layoutedNodes } = useGraphLayout(nodes, edges, 'TB');

  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={layoutedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
