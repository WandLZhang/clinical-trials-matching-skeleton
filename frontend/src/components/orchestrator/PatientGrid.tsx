import React from 'react';
import { PatientBox } from './PatientBox';
import './orchestrator.css';

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

interface PatientGridProps {
  patients: Map<string, PatientState>;
  inclusionCount: number;
  exclusionCount: number;
}

export const PatientGrid: React.FC<PatientGridProps> = ({
  patients,
  inclusionCount,
  exclusionCount
}) => {
  const patientArray = Array.from(patients.values());

  return (
    <div className="patient-grid">
      {patientArray.map((patient) => (
        <div key={patient.patientId} className="patient-grid-item">
          <PatientBox
            patientId={patient.patientId}
            status={patient.status}
            criteria={patient.criteria}
            inclusionCount={inclusionCount}
            exclusionCount={exclusionCount}
          />
        </div>
      ))}
    </div>
  );
};
