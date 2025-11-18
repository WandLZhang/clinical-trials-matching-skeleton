import React, { useEffect, useState } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { Agent1WrapperNode, Agent2WrapperNode, PatientWrapperNode } from './ClinicalTrialFlowNodes';

const nodeTypes = {
  agent1: Agent1WrapperNode,
  agent2: Agent2WrapperNode,
  patient: PatientWrapperNode,
};

// Layout configuration - horizontal flow
const AGENT1_X = 100;
const AGENT2_X = 800;  // Reduced from 1400 to bring nodes closer
const PATIENTS_START_X = 1500;  // Reduced from 2400 to bring nodes closer
const PATIENT_SPACING_Y = 300;

interface CriterionState {
  index: number;
  type: 'inclusion' | 'exclusion';
  status: 'loading' | 'pass' | 'fail' | 'unclear';
  criterion?: string;
  evidence?: string;
  reasoning?: string;
}

interface PatientState {
  patientId: string;
  status: 'loading' | 'eligible' | 'excluded' | 'requires_followup';
  criteria: CriterionState[];
}

interface ClinicalTrialsFlowDiagramProps {
  agent1Data?: any;
  agent2Data?: {
    totalPatients?: number;
    processedPatients?: number;
    eligibleCount?: number;
    excludedCount?: number;
    status?: 'searching' | 'processing' | 'complete';
  };
  patients?: Map<string, PatientState>;
  inclusionCount?: number;
  exclusionCount?: number;
  onAgent1Complete?: (data: any) => void;
}

const ClinicalTrialsFlowDiagramInner: React.FC<ClinicalTrialsFlowDiagramProps> = ({
  agent1Data,
  agent2Data = {},
  patients = new Map(),
  inclusionCount = 0,
  exclusionCount = 0,
  onAgent1Complete,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setViewport } = useReactFlow();

  // Initialize nodes - only Agent1 initially
  useEffect(() => {
    const initialNodes: Node[] = [
      {
        id: 'agent1',
        type: 'agent1',
        position: { x: AGENT1_X, y: 100 },
        data: {
          onComplete: onAgent1Complete || (() => {}),
          trialData: agent1Data,
        },
        draggable: false,
      },
    ];

    setNodes(initialNodes);
    setEdges([]);
  }, []);

  // Update Agent1 node when data changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === 'agent1') {
          return {
            ...node,
            data: {
              ...node.data,
              trialData: agent1Data,
            },
          };
        }
        return node;
      })
    );
  }, [agent1Data, setNodes]);

  // Add Agent2 node and edge when Agent1 completes
  useEffect(() => {
    if (!agent1Data) return;

    setNodes((nds) => {
      // Check if Agent2 already exists
      const hasAgent2 = nds.some((n) => n.id === 'agent2');
      if (hasAgent2) return nds;

      // Add Agent2 node
      const agent2Node: Node = {
        id: 'agent2',
        type: 'agent2',
        position: { x: AGENT2_X, y: 100 },
        data: {
          totalPatients: agent2Data.totalPatients || 0,
          processedPatients: agent2Data.processedPatients || 0,
          eligibleCount: agent2Data.eligibleCount || 0,
          excludedCount: agent2Data.excludedCount || 0,
          status: agent2Data.status || 'searching',
        },
        draggable: false,
      };

      return [...nds, agent2Node];
    });

    // Add edge from Agent1 to Agent2
    setEdges((eds) => {
      const hasEdge = eds.some((e) => e.id === 'e-agent1-agent2');
      if (hasEdge) return eds;

      return [
        ...eds,
        {
          id: 'e-agent1-agent2',
          source: 'agent1',
          target: 'agent2',
          sourceHandle: 'source-right',
          targetHandle: 'target-left',
          animated: false,
          style: { strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed },
        },
      ];
    });

    // Pan viewport to show Agent2 centered
    setTimeout(() => {
      setViewport(
        {
          x: -AGENT2_X + 400,
          y: -50,
          zoom: 0.8,
        },
        { duration: 800 }
      );
    }, 500);
  }, [agent1Data, agent2Data, setNodes, setEdges, setViewport]);

  // Update Agent2 data when it changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === 'agent2') {
          return {
            ...node,
            data: {
              totalPatients: agent2Data.totalPatients || 0,
              processedPatients: agent2Data.processedPatients || 0,
              eligibleCount: agent2Data.eligibleCount || 0,
              excludedCount: agent2Data.excludedCount || 0,
              status: agent2Data.status || 'searching',
            },
          };
        }
        return node;
      })
    );
  }, [agent2Data, setNodes]);

  // Create/update patient nodes
  useEffect(() => {
    if (patients.size === 0) return;

    const patientArray = Array.from(patients.entries());
    const newPatientNodes: Node[] = [];
    const newPatientEdges: Edge[] = [];

    patientArray.forEach(([patientId, patientState], index) => {
      const yPos = 100 + index * PATIENT_SPACING_Y;
      const patientNodeId = `patient-${patientId}`;

      newPatientNodes.push({
        id: patientNodeId,
        type: 'patient',
        position: { x: PATIENTS_START_X, y: yPos },
        data: {
          patientId,
          status: patientState.status,
          criteria: patientState.criteria,
          inclusionCount,
          exclusionCount,
        },
        draggable: false,
      });

      // Edge from Agent2 to Patient
      newPatientEdges.push({
        id: `e-agent2-${patientNodeId}`,
        source: 'agent2',
        target: patientNodeId,
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        animated: false,
        style: { strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });

    // Update nodes and edges
    setNodes((nds) => {
      const agent1Node = nds.find((n) => n.id === 'agent1');
      const agent2Node = nds.find((n) => n.id === 'agent2');
      
      return [agent1Node!, agent2Node!, ...newPatientNodes];
    });

    setEdges((eds) => {
      const agent1ToAgent2Edge = eds.find((e) => e.id === 'e-agent1-agent2');
      return [agent1ToAgent2Edge!, ...newPatientEdges];
    });

    // Don't pan viewport when patients appear - keep focused on Agent 2
  }, [patients, inclusionCount, exclusionCount, setNodes, setEdges, setViewport]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView={false}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 300, y: -50, zoom: 0.8 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255, 255, 255, 0.1)"
          style={{ opacity: 0.3 }}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};

// Wrapper component to provide ReactFlow context
export const ClinicalTrialsFlowDiagram: React.FC<ClinicalTrialsFlowDiagramProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ClinicalTrialsFlowDiagramInner {...props} />
    </ReactFlowProvider>
  );
};
