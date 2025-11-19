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
import { Agent1WrapperNode, Agent2WrapperNode, PatientNode } from './ClinicalTrialFlowNodes';

const nodeTypes = {
  agent1: Agent1WrapperNode,
  agent2: Agent2WrapperNode,
  patient: PatientNode,
};

// Layout configuration - horizontal flow
const AGENT1_X = 100;
const AGENT2_X = 800;  // Reduced from 1400 to bring nodes closer
const PATIENT_X = 1600;  // Position for patient nodes
const PATIENT_Y_START = 200;
const PATIENT_Y_SPACING = 80;

interface ClinicalTrialsFlowDiagramProps {
  agent1Data?: any;
  agent2Data?: {
    totalPatients?: number;
    processedPatients?: number;
    eligibleCount?: number;
    excludedCount?: number;
    status?: 'searching' | 'processing' | 'complete';
    sseEvents?: Array<{ timestamp: string; data: any }>;
  };
  flowData?: {
    patients: {
      [patientId: string]: {
        patientId: string;
        eligibility?: 'ELIGIBLE' | 'EXCLUDED' | 'REQUIRES_FOLLOW_UP';
        endTime?: string;
        evaluations?: any;
      };
    };
    totalPatients: number;
  };
  onAgent1Complete?: (data: any) => void;
}

const ClinicalTrialsFlowDiagramInner: React.FC<ClinicalTrialsFlowDiagramProps> = ({
  agent1Data,
  agent2Data = {},
  flowData,
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
        position: { x: AGENT1_X, y: 200 },
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
        position: { x: AGENT2_X, y: 200 },
        data: {
          totalPatients: agent2Data.totalPatients || 0,
          processedPatients: agent2Data.processedPatients || 0,
          eligibleCount: agent2Data.eligibleCount || 0,
          excludedCount: agent2Data.excludedCount || 0,
          status: agent2Data.status || 'searching',
          sseEvents: agent2Data.sseEvents || [],
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
              sseEvents: agent2Data.sseEvents || [],
            },
          };
        }
        return node;
      })
    );
  }, [agent2Data, setNodes]);

  // Add patient nodes when flowData is available
  useEffect(() => {
    if (!flowData || !flowData.patients || Object.keys(flowData.patients).length === 0) return;

    const patientIds = Object.keys(flowData.patients);
    const patientNodes: Node[] = [];
    const patientEdges: Edge[] = [];

    // Create patient nodes
    patientIds.forEach((patientId, index) => {
      const patient = flowData.patients[patientId];
      const nodeId = `patient-${patientId}`;
      
      // Check if this patient node already exists
      const existingNode = nodes.find(n => n.id === nodeId);
      
      if (!existingNode) {
        patientNodes.push({
          id: nodeId,
          type: 'patient',
          position: { 
            x: PATIENT_X, 
            y: PATIENT_Y_START + (index * PATIENT_Y_SPACING) 
          },
          data: {
            patientId: patientId,
            eligibility: patient.eligibility,
            isProcessing: !patient.endTime,
            evaluations: patient.evaluations,
          },
          draggable: false,
        });
        
        // Create edge from Agent2 to this patient
        patientEdges.push({
          id: `edge-agent2-${nodeId}`,
          source: 'agent2',
          target: nodeId,
          sourceHandle: 'source-right',
          targetHandle: 'target-left',
          style: { strokeWidth: 1 },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
    });

    if (patientNodes.length > 0) {
      setNodes(nds => [...nds.filter(n => !n.id.startsWith('patient-')), ...patientNodes]);
      setEdges(eds => [...eds.filter(e => !e.id.startsWith('edge-agent2-patient-')), ...patientEdges]);
      
      // Adjust viewport to show patient nodes
      setTimeout(() => {
        setViewport(
          {
            x: -AGENT2_X + 200,
            y: -50,
            zoom: 0.6,
          },
          { duration: 800 }
        );
      }, 100);
    }

    // Update existing patient nodes with new data
    setNodes(nds =>
      nds.map((node) => {
        if (node.id.startsWith('patient-')) {
          const patientId = node.id.replace('patient-', '');
          const patient = flowData.patients[patientId];
          if (patient) {
            return {
              ...node,
              data: {
                patientId: patientId,
                eligibility: patient.eligibility,
                isProcessing: !patient.endTime,
                evaluations: patient.evaluations,
              },
            };
          }
        }
        return node;
      })
    );
  }, [flowData, setNodes, setEdges, setViewport]);

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
