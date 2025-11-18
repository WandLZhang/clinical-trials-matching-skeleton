import React from 'react';
import { Handle, Position } from 'reactflow';
import { Agent1 } from './Agent1';
import { Agent2Box } from './orchestrator/Agent2Box';
import { PatientBox } from './orchestrator/PatientBox';

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

interface PatientWrapperNodeData {
  patientId: string;
  status: 'loading' | 'eligible' | 'excluded' | 'requires_followup';
  criteria: Array<{
    index: number;
    type: 'inclusion' | 'exclusion';
    status: 'loading' | 'pass' | 'fail' | 'unclear';
    criterion?: string;
    evidence?: string;
    reasoning?: string;
  }>;
  inclusionCount: number;
  exclusionCount: number;
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
        totalPatients={data.totalPatients}
        processedPatients={data.processedPatients}
        eligibleCount={data.eligibleCount}
        excludedCount={data.excludedCount}
        status={data.status}
        sseEvents={data.sseEvents || []}
      />
    </div>
  );
};

export const PatientWrapperNode: React.FC<{ data: PatientWrapperNodeData }> = ({ data }) => {
  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} id="target-left" />
      <PatientBox
        patientId={data.patientId}
        status={data.status}
        criteria={data.criteria}
        inclusionCount={data.inclusionCount}
        exclusionCount={data.exclusionCount}
      />
    </div>
  );
};
