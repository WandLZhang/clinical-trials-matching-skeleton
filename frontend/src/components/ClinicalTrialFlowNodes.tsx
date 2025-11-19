import React from 'react';
import { Handle, Position } from 'reactflow';
import { Agent1 } from './Agent1';
import { Agent2Box } from './orchestrator/Agent2Box';
import { Agent4Box } from './orchestrator/Agent4Box';
import { PatientNode } from './PatientNode';
import { FolderNode } from './FolderNode';
import { PipelineRowNode } from './PipelineRowNode';
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

interface Agent4WrapperNodeData {
  status: 'waiting' | 'processing' | 'complete';
  sseEvents?: Array<{ timestamp: string; data: any }>;
}

interface FolderWrapperNodeData {
  patientId: string;
  folderUrl: string;
}

interface PipelineRowWrapperNodeData {
  trialId: string;
  trialTitle: string;
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

export const Agent4WrapperNode: React.FC<{ data: Agent4WrapperNodeData }> = ({ data }) => {
  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Agent4Box
        status={data.status}
        sseEvents={data.sseEvents || []}
      />
    </div>
  );
};

export const FolderWrapperNode: React.FC<{ data: FolderWrapperNodeData }> = ({ data }) => {
  return (
    <div style={{ position: 'relative' }}>
      <FolderNode data={data} />
    </div>
  );
};

export const PipelineRowWrapperNode: React.FC<{ data: PipelineRowWrapperNodeData }> = ({ data }) => {
  return (
    <div style={{ position: 'relative' }}>
      <PipelineRowNode data={data} />
    </div>
  );
};

export { PatientNode };
