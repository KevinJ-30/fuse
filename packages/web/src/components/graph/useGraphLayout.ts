import { useMemo } from 'react';
import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

export function useGraphLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') {
  return useMemo(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: 50,
      ranksep: 100,
      marginx: 50,
      marginy: 50,
    });

    // Add nodes to dagre graph
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    // Add edges to dagre graph
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate layout
    dagre.layout(dagreGraph);

    // Update node positions
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }, [nodes, edges, direction]);
}
