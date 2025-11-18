import React from 'react';
import { PatientBox } from './PatientBox';
import { FollowUpBox } from './FollowUpBox';
import './orchestrator.css';

interface CriterionState {
  index: number;
  type: 'inclusion' | 'exclusion';
  status: 'loading' | 'pass' | 'fail' | 'unclear';
  criterion?: string;
  evidence?: string;
  reasoning?: string;
  filter_type?: string;
  field?: string;
}

interface PatientState {
  patientId: string;
  status: 'loading' | 'eligible' | 'excluded' | 'requires_followup';
  criteria: CriterionState[];
  followUpItems?: string[];
  reasonType?: string;
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
        <div key={patient.patientId} style={{ marginBottom: '16px' }}>
          {/* Patient box and follow-up box in horizontal layout */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <PatientBox
                patientId={patient.patientId}
                status={patient.status}
                criteria={patient.criteria}
                inclusionCount={inclusionCount}
                exclusionCount={exclusionCount}
              />
            </div>
            
            {/* Show follow-up box if patient requires follow-up and has items */}
            {patient.status === 'requires_followup' && patient.followUpItems && patient.followUpItems.length > 0 && (
              <>
                <div style={{ 
                  fontSize: '24px', 
                  color: '#FF9800',
                  alignSelf: 'center',
                  marginTop: '40px'
                }}>
                  →
                </div>
                <FollowUpBox
                  patientId={patient.patientId}
                  followUpItems={patient.followUpItems}
                />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
