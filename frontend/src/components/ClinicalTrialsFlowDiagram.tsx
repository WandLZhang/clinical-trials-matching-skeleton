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
import { Agent1WrapperNode, Agent2WrapperNode, Agent4WrapperNode, PatientNode, FolderWrapperNode, PipelineRowWrapperNode } from './ClinicalTrialFlowNodes';

const nodeTypes = {
  agent1: Agent1WrapperNode,
  agent2: Agent2WrapperNode,
  agent4: Agent4WrapperNode,
  patient: PatientNode,
  folder: FolderWrapperNode,
  pipelineRow: PipelineRowWrapperNode,
};

// Layout configuration - horizontal flow
const AGENT1_X = 100;
const AGENT2_X = 800;  // Reduced from 1400 to bring nodes closer
const PATIENT_X = 1600;  // Position for patient nodes
const AGENT4_X = 2100; // Position for Agent 4 (Closer to patients)
const FOLDER_X = 3050; // Position for Folder nodes
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
  agent4Data?: {
    status: 'waiting' | 'processing' | 'complete';
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
  agent4Data = { status: 'waiting', sseEvents: [] },
  flowData,
  onAgent1Complete,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isScaling, setIsScaling] = useState(false);
  const { setViewport } = useReactFlow();
  
  // Refs to track viewport transitions
  const hasPannedToAgent2 = React.useRef(false);
  const hasPannedToPatients = React.useRef(false);
  const hasPannedToAgent4 = React.useRef(false);

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
    if (!hasPannedToAgent2.current) {
      hasPannedToAgent2.current = true;
      setTimeout(() => {
        setViewport(
          {
            x: -AGENT2_X + 600, // Adjusted to move view left
            y: -50,
            zoom: 0.8,
          },
          { duration: 800 }
        );
      }, 500);
    }
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
      
      // Adjust viewport to show patient nodes (only once when patients first appear)
      if (!hasPannedToPatients.current) {
        hasPannedToPatients.current = true;
        setTimeout(() => {
          setViewport(
            {
              x: -AGENT2_X + 400, // Adjusted to move view left
              y: -50,
              zoom: 0.75, // Increased zoom (was 0.6)
            },
            { duration: 800 }
          );
        }, 100);
      }
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

  // Add Agent4 node and edges when Agent2 completes
  useEffect(() => {
    if (agent2Data.status !== 'complete') return;

    setNodes((nds) => {
      const hasAgent4 = nds.some((n) => n.id === 'agent4');
      if (hasAgent4) return nds;

      const agent4Node: Node = {
        id: 'agent4',
        type: 'agent4',
        position: { x: AGENT4_X, y: 200 },
        data: {
          status: agent4Data.status || 'waiting',
          sseEvents: agent4Data.sseEvents || [],
        },
        draggable: false,
      };

      return [...nds, agent4Node];
    });

    // Add edges from all processed patients to Agent 4
    if (flowData && flowData.patients) {
      const patientIds = Object.keys(flowData.patients);
      const newEdges: Edge[] = [];
      const isComplete = agent4Data.status === 'complete';
      
      patientIds.forEach(patientId => {
        const edgeId = `edge-patient-${patientId}-agent4`;
        // Only add edge if patient is processed
        if (flowData.patients[patientId].endTime) {
          newEdges.push({
            id: edgeId,
            source: `patient-${patientId}`,
            target: 'agent4',
            sourceHandle: 'source-right',
            targetHandle: 'target-left',
            animated: !isComplete,
            style: { 
              strokeWidth: isComplete ? 2 : 1, 
              stroke: '#4CAF50', 
              opacity: isComplete ? 1 : 0.5 
            },
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        }
      });

      setEdges(eds => {
        // Update existing edges to match new animation state
        const updatedEds = eds.map(e => {
          if (e.target === 'agent4' && e.source.startsWith('patient-')) {
            return {
              ...e,
              animated: !isComplete,
              style: { 
                strokeWidth: isComplete ? 2 : 1, 
                stroke: '#4CAF50', 
                opacity: isComplete ? 1 : 0.5 
              }
            };
          }
          return e;
        });

        const existingEdgeIds = new Set(updatedEds.map(e => e.id));
        const uniqueNewEdges = newEdges.filter(e => !existingEdgeIds.has(e.id));
        return [...updatedEds, ...uniqueNewEdges];
      });
    }

    // Pan viewport to show Agent4 but keep some criteria boxes visible
    if (!hasPannedToAgent4.current) {
      hasPannedToAgent4.current = true;
      setTimeout(() => {
        setViewport(
          {
            x: -AGENT4_X + 700, // Adjusted to show context to the left of Agent 4
            y: -50,
            zoom: 0.8,
          },
          { duration: 1200 }
        );
      }, 1000);
    }

  }, [agent2Data.status, flowData, agent4Data, setNodes, setEdges, setViewport]);

  // Update Agent4 data
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === 'agent4') {
          return {
            ...node,
            data: {
              status: agent4Data.status || 'waiting',
              sseEvents: agent4Data.sseEvents || [],
            },
          };
        }
        return node;
      })
    );

    // Process Agent 4 events to add Folder nodes
    if (agent4Data.sseEvents) {
      const folderEvents = agent4Data.sseEvents.filter(
        (e) => e.data.status === 'progress' && e.data.folderUrl && e.data.patientId
      );

      if (folderEvents.length > 0) {
        setNodes((nds) => {
          const newNodes = [...nds];
          
          folderEvents.forEach((event, index) => {
            const nodeId = `folder-${event.data.patientId}`;
            const hasNode = newNodes.some((n) => n.id === nodeId);
            
            if (!hasNode) {
              newNodes.push({
                id: nodeId,
                type: 'folder',
                position: { 
                  x: FOLDER_X, 
                  y: PATIENT_Y_START + (index * PATIENT_Y_SPACING) // Stack them like patients
                },
                data: {
                  patientId: event.data.patientId,
                  folderUrl: event.data.folderUrl,
                },
                draggable: false,
              });
            }
          });
          
          return newNodes;
        });

        setEdges((eds) => {
          const isComplete = agent4Data.status === 'complete';
          
          // Update existing edges
          const updatedEds = eds.map(e => {
            if (e.source === 'agent4' && e.target.startsWith('folder-')) {
              return {
                ...e,
                animated: !isComplete,
                style: { 
                  strokeWidth: isComplete ? 2 : 1, 
                  stroke: '#2196F3' 
                }
              };
            }
            return e;
          });

          const newEdges = [...updatedEds];
          
          folderEvents.forEach((event) => {
            const nodeId = `folder-${event.data.patientId}`;
            const edgeId = `edge-agent4-${nodeId}`;
            const hasEdge = newEdges.some((e) => e.id === edgeId);
            
            if (!hasEdge) {
              newEdges.push({
                id: edgeId,
                source: 'agent4',
                target: nodeId,
                sourceHandle: 'source-right',
                targetHandle: 'target-left',
                animated: !isComplete,
                style: { 
                  strokeWidth: isComplete ? 2 : 1, 
                  stroke: '#2196F3' 
                },
                markerEnd: { type: MarkerType.ArrowClosed },
              });
            }
          });
          
          return newEdges;
        });
      }
    }
  }, [agent4Data, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView={false}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 300, y: -50, zoom: 0.8 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        style={{
            filter: isScaling ? 'grayscale(100%) opacity(0.4)' : 'none',
            transition: 'filter 1.5s ease-in-out',
        }}
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
      <style>{`
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(50px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Programmatic Scale Overlay */}
      {isScaling && (
        <div className="scale-overlay">
          <div className="scale-header">
            <h1>Programmatic Scale</h1>
            <p>Scaling to 450,000+ Clinical Trials</p>
          </div>
          <style>{`
            .scale-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
              z-index: 2000;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .scale-header {
              /* Transparent background as requested */
              background: transparent;
              padding: 0;
              text-align: center;
              animation: fadeInScale 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
            .scale-header h1 {
              font-size: 5rem; /* Larger font size */
              margin: 0 0 16px 0;
              color: #1a237e;
              font-weight: 800;
              letter-spacing: -1px;
              /* Ensure readability against background */
              text-shadow: 0 4px 12px rgba(255,255,255,0.8);
            }
            .scale-header p {
              font-size: 1.8rem;
              margin: 0;
              color: #546e7a;
              font-weight: 600;
              letter-spacing: 2px;
              text-transform: uppercase;
              text-shadow: 0 2px 8px rgba(255,255,255,0.8);
            }
            @keyframes fadeInScale {
              from { opacity: 0; transform: scale(0.8) translateY(20px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}

      {agent4Data.status === 'complete' && !isScaling && (
        <button
          onClick={() => {
            setIsScaling(true);
            
            // Scale out animation - anchor top-left to original pipeline
            // With the grid extending right and down, we want to see the top-left corner
            // zoom=0.1 fills the screen width with fewer columns but more detail
            setViewport({ x: 0, y: 0, zoom: 0.1 }, { duration: 2000 });
            
            // Add replica nodes
            // Add replica nodes
            const mockTrials = Array.from({ length: 100 }).map((_, i) => {
              const id = `NCT${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
              const conditions = ["Diabetes", "Hypertension", "Asthma", "Back Pain", "Depression", "Anxiety", "Arthritis", "Cancer", "Heart Disease", "Obesity"];
              const condition = conditions[i % conditions.length];
              return `${id} - ${condition} Study ${i+1}`;
            });

            setTimeout(() => {
              const newNodes: Node[] = [];
              
              // Grid configuration
              const COLUMNS = 5;
              const START_X = AGENT1_X; // Start x same as main
              const START_Y = 1200;     // Start below main
              const SPACING_X = 4000;   // Width of row + gap
              const SPACING_Y = 800;    // Height of row + gap
              
              mockTrials.forEach((trial, index) => {
                const [id, title] = trial.split(' - ');
                
                // Calculate grid position
                const col = index % COLUMNS;
                const row = Math.floor(index / COLUMNS);
                
                const x = START_X + (col * SPACING_X);
                const y = START_Y + (row * SPACING_Y);
                
                newNodes.push({
                  id: `replica-${index}`,
                  type: 'pipelineRow',
                  position: { x, y },
                  data: { trialId: id, trialTitle: title },
                  draggable: false,
                  style: {
                    animation: `fadeInUp 0.5s ease-out ${(row * 0.1) + (col * 0.05)}s backwards`,
                  }
                });
              });
              
              setNodes(nds => [...nds, ...newNodes]);
            }, 500);
          }}
          style={{
            position: 'absolute',
            right: '40px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            animation: 'slideInRight 0.5s ease-out, pulse 2s infinite',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>
            arrow_forward
          </span>
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translate(100px, -50%); }
              to { opacity: 1; transform: translate(0, -50%); }
            }
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
              70% { box-shadow: 0 0 0 20px rgba(33, 150, 243, 0); }
              100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
            }
          `}</style>
        </button>
      )}
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
