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

  // Separate patients that need follow-up
  const standardPatients = patientArray.filter(p => p.status !== 'requires_followup');
  const followupPatients = patientArray.filter(p => p.status === 'requires_followup');

  return (
    <div>
      {/* Grid for standard patients */}
      <div className="patient-grid" style={{ marginBottom: '24px' }}>
        {standardPatients.map((patient) => (
          <PatientBox
            key={patient.patientId}
            patientId={patient.patientId}
            status={patient.status}
            criteria={patient.criteria}
            inclusionCount={inclusionCount}
            exclusionCount={exclusionCount}
          />
        ))}
      </div>

      {/* Separate section for patients requiring follow-up */}
      {followupPatients.length > 0 && (
        <div>
          <h3 style={{ paddingLeft: '8px', color: '#FF9800' }}>Requires Follow-up</h3>
          {followupPatients.map((patient) => (
            <div key={patient.patientId} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <PatientBox
                  patientId={patient.patientId}
                  status={patient.status}
                  criteria={patient.criteria}
                  inclusionCount={inclusionCount}
                  exclusionCount={exclusionCount}
                />
              </div>
              {patient.followUpItems && patient.followUpItems.length > 0 && (
                <>
                  <div style={{ fontSize: '24px', color: '#FF9800', alignSelf: 'center', marginTop: '40px' }}>→</div>
                  <FollowUpBox
                    patientId={patient.patientId}
                    followUpItems={patient.followUpItems}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
