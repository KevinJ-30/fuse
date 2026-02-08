import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Panel as FlowPanel,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import ExecutionNode from '../components/graph/ExecutionNode';
import { Badge, AnimatedCounter, SkeletonCard } from '../components/ui';

/* ============================
   Types
   ============================ */

interface Execution {
  id: string;
  agentId: string;
  tool: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  parentId: string | null;
  riskScore?: number;
  input?: any;
  output?: any;
  detectionFlags?: any;
  metadata?: any;
  previousState?: any;
}

type ViewMode = 'graph' | 'list';

/* ============================
   Constants
   ============================ */

const NODE_WIDTH = 260;
const NODE_HEIGHT = 110;

const nodeTypes = { execution: ExecutionNode };

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXECUTING', label: 'Executing' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'ROLLED_BACK', label: 'Rolled Back' },
];

/* ============================
   Dagre Layout Helper
   ============================ */

function getLayoutedElements(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ============================
   Status Helpers
   ============================ */

function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'EXECUTED') return 'success';
  if (s === 'PENDING' || s === 'AWAITING_APPROVAL') return 'warning';
  if (s === 'FAILED' || s === 'BLOCKED') return 'danger';
  if (s === 'EXECUTING') return 'info';
  return 'neutral';
}

function getEdgeStyle(status: string) {
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'EXECUTED') return { stroke: '#30d158', strokeWidth: 2 };
  if (s === 'FAILED' || s === 'BLOCKED') return { stroke: '#ff453a', strokeWidth: 2 };
  if (s === 'EXECUTING') return { stroke: '#0071e3', strokeWidth: 2 };
  return { stroke: '#48484a', strokeWidth: 1.5 };
}

function getRiskLabel(score: number) {
  if (score >= 0.95) return { label: 'Critical', color: 'text-accent-red' };
  if (score >= 0.6) return { label: 'High', color: 'text-accent-red' };
  if (score >= 0.3) return { label: 'Medium', color: 'text-accent-orange' };
  return { label: 'Low', color: 'text-accent-green' };
}

/* ============================
   Main Component
   ============================ */

export default function ExecutionGraph() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterTool, setFilterTool] = useState('');
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* --- Data Loading --- */
  const loadExecutions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (filterStatus) params.append('status', filterStatus);
      if (filterAgent) params.append('agentId', filterAgent);
      if (filterTool) params.append('tool', filterTool);
      
      const response = await apiClient.get(`/api/executions?${params.toString()}`);
      setExecutions(response.data.executions || []);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAgent, filterTool]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  /* --- Real-time Updates --- */
  useEffect(() => {
    const socket = getSocket();
    const handleUpdate = () => loadExecutions();

    socket.on('execution:new', handleUpdate);
    socket.on('execution:completed', handleUpdate);
    socket.on('execution:blocked', handleUpdate);
    socket.on('execution:failed', handleUpdate);

    return () => {
      socket.off('execution:new', handleUpdate);
      socket.off('execution:completed', handleUpdate);
      socket.off('execution:blocked', handleUpdate);
      socket.off('execution:failed', handleUpdate);
    };
  }, [loadExecutions]);

  /* --- Graph Layout --- */
  useEffect(() => {
    if (executions.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: Node[] = executions.map((exec) => ({
      id: exec.id,
      type: 'execution',
      position: { x: 0, y: 0 },
      data: {
        agentId: exec.agentId,
        tool: exec.tool,
        status: exec.status,
        riskScore: exec.riskScore,
        createdAt: exec.createdAt,
        onClick: () => setSelectedExecution(exec),
      },
    }));

    // Only create edges where both source and target exist
    const execIdSet = new Set(executions.map(e => e.id));
    const newEdges: Edge[] = executions
      .filter(exec => exec.parentId && execIdSet.has(exec.parentId))
      .map(exec => ({
        id: `e-${exec.parentId}-${exec.id}`,
        source: exec.parentId!,
        target: exec.id,
        type: 'smoothstep',
        animated: exec.status === 'EXECUTING' || exec.status === 'PENDING',
        style: getEdgeStyle(exec.status),
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges,
      direction
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [executions, direction, setNodes, setEdges]);

  /* --- Stats --- */
  const stats = useMemo(() => {
    const total = executions.length;
    const completed = executions.filter(e => ['COMPLETED', 'EXECUTED'].includes(e.status.toUpperCase())).length;
    const failed = executions.filter(e => ['FAILED', 'BLOCKED'].includes(e.status.toUpperCase())).length;
    const pending = executions.filter(e => ['PENDING', 'AWAITING_APPROVAL', 'EXECUTING'].includes(e.status.toUpperCase())).length;
    const avgRisk = executions.reduce((sum, e) => sum + (e.riskScore || 0), 0) / (total || 1);
    return { total, completed, failed, pending, avgRisk };
  }, [executions]);

  /* --- Unique agents/tools for filters --- */
  const uniqueAgents = useMemo(
    () => [...new Set(executions.map(e => e.agentId))],
    [executions]
  );
  const uniqueTools = useMemo(
    () => [...new Set(executions.map(e => e.tool))],
    [executions]
  );

  /* --- Node Click in Graph --- */
  const onNodeClick: NodeMouseHandler = useCallback((_event: React.MouseEvent, node: Node) => {
    const exec = executions.find(e => e.id === node.id);
    if (exec) setSelectedExecution(exec);
  }, [executions]);

  /* ============================
     Render
     ============================ */

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 animate-fade-in-up opacity-0">
          <div className="skeleton h-8 w-64 mb-2" />
          <div className="skeleton h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="skeleton h-[500px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 animate-fade-in-up opacity-0">
        <div>
          <h1 className="text-h1 text-primary-text mb-1">Execution Graph</h1>
          <p className="text-body-lg text-secondary-text">
            Visualize agent execution flow and relationships
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-layer-2 rounded-lg border border-white/10 p-1">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 text-body-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === 'graph'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                Graph
              </span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-body-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                List
              </span>
            </button>
          </div>

          {viewMode === 'graph' && (
            <button
              onClick={() => setDirection(d => d === 'TB' ? 'LR' : 'TB')}
              className="btn-secondary gap-2"
              title="Toggle layout direction"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              {direction === 'TB' ? 'Vertical' : 'Horizontal'}
            </button>
          )}

          <button
            onClick={loadExecutions}
            className="btn-secondary gap-2"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 animate-fade-in-up opacity-0 delay-1">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Completed" value={stats.completed} color="text-accent-green" />
        <MiniStat label="Failed" value={stats.failed} color="text-accent-red" />
        <MiniStat label="In Progress" value={stats.pending} color="text-accent-blue" />
        <MiniStat label="Avg Risk" value={stats.avgRisk.toFixed(2)} color="text-accent-orange" isText />
      </div>

      {/* Filters */}
      <div className="bg-layer-1 border border-white/10 rounded-lg p-4 mb-6 animate-fade-in-up opacity-0 delay-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select-field"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="select-field"
          >
            <option value="">All Agents</option>
            {uniqueAgents.map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>

          <select
            value={filterTool}
            onChange={(e) => setFilterTool(e.target.value)}
            className="select-field"
          >
            <option value="">All Tools</option>
            {uniqueTools.map(tool => (
              <option key={tool} value={tool}>{tool}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      {executions.length === 0 ? (
        <EmptyState />
      ) : viewMode === 'graph' ? (
        <GraphView
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
        />
      ) : (
        <ListView
          executions={executions}
          onSelect={setSelectedExecution}
        />
      )}

      {/* Detail Modal */}
      {selectedExecution && (
        <DetailModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
}

/* ============================
   Sub-Components
   ============================ */

function MiniStat({ 
  label, 
  value, 
  color = 'text-primary-text',
  isText = false 
}: { 
  label: string; 
  value: number | string; 
  color?: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-layer-1 border border-white/10 rounded-lg px-4 py-3 
                    transition-all duration-200 hover:border-white/15">
      <p className="text-caption text-tertiary-text mb-1">{label}</p>
      <p className={`text-h2 font-bold tabular-nums ${color}`}>
        {isText ? value : (
          <AnimatedCounter value={value as number} duration={1200} />
        )}
      </p>
    </div>
  );
}

function GraphView({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onNodeClick: NodeMouseHandler;
}) {
  return (
    <div 
      className="bg-layer-1 border border-white/10 rounded-lg overflow-hidden 
                 animate-fade-in-up opacity-0 delay-3"
      style={{ height: 'calc(100vh - 420px)', minHeight: 500 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#050505' }}
      >
        <Background color="#1a1a1a" gap={20} size={1} />
        <Controls 
          style={{ 
            background: '#0a0a0a', 
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
          }}
        />
        <MiniMap 
          nodeStrokeColor="#0071e3"
          nodeColor={(n: Node) => {
            const status = n.data?.status?.toUpperCase() || '';
            if (status === 'COMPLETED' || status === 'EXECUTED') return '#30d158';
            if (status === 'FAILED' || status === 'BLOCKED') return '#ff453a';
            if (status === 'EXECUTING') return '#0071e3';
            return '#48484a';
          }}
          maskColor="rgba(0,0,0,0.7)"
          style={{
            background: '#0a0a0a',
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
          }}
        />
        <FlowPanel position="top-left">
          <div className="flex gap-2 bg-base/80 backdrop-blur-lg p-2 rounded-lg border border-white/10">
            <Badge variant="success" size="sm">Completed</Badge>
            <Badge variant="warning" size="sm">Pending</Badge>
            <Badge variant="danger" size="sm">Failed</Badge>
            <Badge variant="info" size="sm">Executing</Badge>
          </div>
        </FlowPanel>
      </ReactFlow>
    </div>
  );
}

function ListView({
  executions,
  onSelect,
}: {
  executions: Execution[];
  onSelect: (exec: Execution) => void;
}) {
  return (
    <div className="space-y-3 animate-fade-in-up opacity-0 delay-3">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-caption text-tertiary-text">
        <div className="col-span-1">Status</div>
        <div className="col-span-2">Agent</div>
        <div className="col-span-2">Tool</div>
        <div className="col-span-2">Risk</div>
        <div className="col-span-2">Time</div>
        <div className="col-span-2">Duration</div>
        <div className="col-span-1">ID</div>
      </div>

      {executions.map((exec, index) => {
        const risk = exec.riskScore !== undefined && exec.riskScore !== null 
          ? getRiskLabel(exec.riskScore) 
          : null;
        const duration = exec.completedAt && exec.createdAt
          ? Math.round((new Date(exec.completedAt).getTime() - new Date(exec.createdAt).getTime()))
          : null;

        return (
          <button
            key={exec.id}
            onClick={() => onSelect(exec)}
            className="
              w-full text-left
              bg-layer-1 border border-white/10 rounded-lg p-4
              transition-all duration-200 ease-standard
              hover:-translate-y-0.5 hover:shadow-card-hover hover:border-white/15
              animate-fade-in-up opacity-0
              grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center
            "
            style={{ animationDelay: `${300 + index * 40}ms` }}
          >
            {/* Status */}
            <div className="md:col-span-1">
              <Badge variant={getStatusVariant(exec.status)} size="sm">
                {exec.status.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Agent */}
            <div className="md:col-span-2">
              <span className="text-body font-medium text-primary-text truncate block" title={exec.agentId}>
                {exec.agentId}
              </span>
            </div>

            {/* Tool */}
            <div className="md:col-span-2">
              <code className="text-body-sm font-mono text-accent-teal">{exec.tool}</code>
            </div>

            {/* Risk */}
            <div className="md:col-span-2">
              {risk ? (
                <div className="flex items-center gap-2">
                  <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        risk.label === 'Low' ? 'bg-accent-green' :
                        risk.label === 'Medium' ? 'bg-accent-orange' : 'bg-accent-red'
                      }`}
                      style={{ width: `${(exec.riskScore || 0) * 100}%` }}
                    />
                  </div>
                  <span className={`text-body-sm font-medium ${risk.color}`}>
                    {(exec.riskScore || 0).toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="text-body-sm text-tertiary-text">—</span>
              )}
            </div>

            {/* Time */}
            <div className="md:col-span-2">
              <span className="text-body-sm text-secondary-text">
                {new Date(exec.createdAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </span>
            </div>

            {/* Duration */}
            <div className="md:col-span-2">
              <span className="text-body-sm font-mono text-secondary-text">
                {duration !== null ? `${duration}ms` : '—'}
              </span>
            </div>

            {/* ID */}
            <div className="md:col-span-1">
              <span className="text-body-sm font-mono text-tertiary-text truncate block" title={exec.id}>
                {exec.id.slice(0, 8)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DetailModal({
  execution,
  onClose,
}: {
  execution: Execution;
  onClose: () => void;
}) {
  const risk = execution.riskScore !== undefined && execution.riskScore !== null
    ? getRiskLabel(execution.riskScore) 
    : null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in-up" 
           style={{ animationDuration: '150ms' }} />
      
      {/* Modal */}
      <div
        className="
          relative w-full max-w-3xl max-h-[90vh] overflow-y-auto
          bg-layer-1 border border-white/10 rounded-xl shadow-xl
          animate-scale-in
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-layer-1/95 backdrop-blur-lg border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant={getStatusVariant(execution.status)}>
                  {execution.status.replace(/_/g, ' ')}
                </Badge>
                {risk && (
                  <span className={`text-body-sm font-medium ${risk.color}`}>
                    Risk: {(execution.riskScore || 0).toFixed(2)} ({risk.label})
                  </span>
                )}
              </div>
              <h2 className="text-h2 text-primary-text">{execution.tool}</h2>
              <p className="text-body-sm text-secondary-text mt-1">
                Agent: {execution.agentId} · ID: <code className="font-mono text-tertiary-text">{execution.id}</code>
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-secondary-text hover:text-primary-text 
                         hover:bg-white/[0.05] transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="Status" value={execution.status.replace(/_/g, ' ')} />
            <InfoItem label="Agent ID" value={execution.agentId} />
            <InfoItem label="Tool" value={execution.tool} mono />
            <InfoItem 
              label="Risk Score" 
              value={execution.riskScore?.toFixed(2) || 'N/A'}
              className={risk?.color}
            />
            <InfoItem 
              label="Started At" 
              value={new Date(execution.createdAt).toLocaleString()} 
            />
            <InfoItem 
              label="Completed At" 
              value={execution.completedAt ? new Date(execution.completedAt).toLocaleString() : '—'} 
            />
            <InfoItem 
              label="Parent ID" 
              value={execution.parentId || 'None (root)'} 
              mono 
            />
            <InfoItem 
              label="Execution ID" 
              value={execution.id} 
              mono 
            />
          </div>

          {/* Risk Bar */}
          {risk && execution.riskScore !== undefined && (
            <div>
              <label className="text-caption text-tertiary-text block mb-2">Risk Level</label>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    risk.label === 'Low' ? 'bg-accent-green' :
                    risk.label === 'Medium' ? 'bg-accent-orange' : 'bg-accent-red'
                  }`}
                  style={{ width: `${(execution.riskScore || 0) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Input */}
          {execution.input && (
            <JsonSection label="Input" data={execution.input} />
          )}

          {/* Output */}
          {execution.output && (
            <JsonSection label="Output" data={execution.output} />
          )}

          {/* Detection Flags */}
          {execution.detectionFlags && (
            <JsonSection label="Detection Flags" data={execution.detectionFlags} />
          )}

          {/* Metadata */}
          {execution.metadata && (
            <JsonSection label="Metadata" data={execution.metadata} />
          )}

          {/* Previous State */}
          {execution.previousState && (
            <JsonSection label="Previous State (for rollback)" data={execution.previousState} />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ 
  label, 
  value, 
  mono = false,
  className = '' 
}: { 
  label: string; 
  value: string; 
  mono?: boolean;
  className?: string;
}) {
  return (
    <div>
      <p className="text-caption text-tertiary-text mb-1">{label}</p>
      <p className={`text-body-sm ${mono ? 'font-mono' : 'font-medium'} text-primary-text truncate ${className}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function JsonSection({ label, data }: { label: string; data: any }) {
  const [expanded, setExpanded] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);
  const isLong = jsonString.length > 500;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-caption text-tertiary-text">{label}</label>
        {isLong && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-body-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      <pre 
        className={`
          bg-base border border-white/[0.06] rounded-lg p-4 
          font-mono text-body-sm text-secondary-text 
          overflow-x-auto
          ${!expanded && isLong ? 'max-h-48' : 'max-h-96'} overflow-y-auto
        `}
      >
        {jsonString}
      </pre>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-layer-1 border border-white/10 rounded-lg p-16 text-center animate-fade-in-up opacity-0 delay-3">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
        <svg className="w-8 h-8 text-tertiary-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      </div>
      <h3 className="text-h2 text-primary-text mb-2">No executions found</h3>
      <p className="text-body text-secondary-text max-w-md mx-auto">
        Executions will appear here once agents start running.
        Try adjusting your filters or triggering a demo scenario.
      </p>
    </div>
  );
}
