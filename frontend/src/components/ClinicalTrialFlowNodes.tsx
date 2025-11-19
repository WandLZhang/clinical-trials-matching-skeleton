import React from 'react';
import { Handle, Position } from 'reactflow';
import { Agent1 } from './Agent1';
import { Agent2Box } from './orchestrator/Agent2Box';
import { PatientNode } from './PatientNode';
import './PatientNode.css';

interface Agent1WrapperNodeData {
  onComplete: (data: any) => void;
  trialData?: any;
}

interface Agent2WrapperNodeData {
  totalPatients: number;
  processedPatients: number;
  eligibleCount: number;
  excludedCount: number;
  status: 'searching' | 'processing' | 'complete';
  sseEvents?: Array<{ timestamp: string; data: any }>;
}

export const Agent1WrapperNode: React.FC<{ data: Agent1WrapperNodeData }> = ({ data }) => {
  return (
    <div style={{ position: 'relative' }}>
      <Handle type="source" position={Position.Right} id="source-right" />
      <Agent1 
        onComplete={data.onComplete}
        showNextButton={false}
      />
    </div>
  );
};

export const Agent2WrapperNode: React.FC<{ data: Agent2WrapperNodeData }> = ({ data }) => {
  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Agent2Box
        status={data.status}
        sseEvents={data.sseEvents || []}
      />
    </div>
  );
};

export { PatientNode };
