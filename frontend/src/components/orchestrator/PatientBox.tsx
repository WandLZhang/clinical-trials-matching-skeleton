import React from 'react';
import { CriterionBox } from './CriterionBox';
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

interface PatientBoxProps {
  patientId: string;
  status: 'loading' | 'eligible' | 'excluded' | 'requires_followup';
  criteria: CriterionState[];
  inclusionCount: number;
  exclusionCount: number;
}

export const PatientBox: React.FC<PatientBoxProps> = ({
  patientId,
  status,
  criteria,
  inclusionCount,
  exclusionCount
}) => {
  const getStatusClass = () => {
    return `patient-box-wide patient-${status}`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'eligible':
        return '✓';
      case 'excluded':
        return '✗';
      case 'requires_followup':
        return '⚠';
      default:
        return '⋯';
    }
  };

  // Extract patient metadata from criteria evidence
  const ageCriterion = criteria.find(c => c.field === 'Patient.birthDate' || c.criterion?.toLowerCase().includes('age'));
  const durationCriterion = criteria.find(c => c.criterion?.toLowerCase().includes('month'));

  const inclusionCriteria = criteria.filter(c => c.type === 'inclusion');
  const exclusionCriteria = criteria.filter(c => c.type === 'exclusion');

  // Pad to expected counts
  while (inclusionCriteria.length < inclusionCount) {
    inclusionCriteria.push({
      index: inclusionCriteria.length,
      type: 'inclusion',
      status: 'loading'
    });
  }

  while (exclusionCriteria.length < exclusionCount) {
    exclusionCriteria.push({
      index: exclusionCriteria.length,
      type: 'exclusion',
      status: 'loading'
    });
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Patient info box - short and wide */}
      <div className={getStatusClass()} style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '8px',
        minHeight: '80px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              <span title={patientId}>Patient: {patientId.substring(0, 12)}...</span>
              <span style={{ marginLeft: '12px', fontSize: '20px' }}>{getStatusIcon()}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#666', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {ageCriterion && (
                <div>Age: {ageCriterion.reasoning?.match(/\d+\s*years?/i)?.[0] || 'Unknown'}</div>
              )}
              {durationCriterion && (
                <div>Duration: {durationCriterion.reasoning?.match(/\d+\s*months?/i)?.[0] || 'Unknown'}</div>
              )}
              <div>Status: {status.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Criteria boxes - skinny and wide, outside patient box */}
      <div style={{ marginLeft: '16px' }}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
            Inclusion Criteria
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '4px' }}>
            {inclusionCriteria.map((c, idx) => (
              <CriterionBox
                key={`inc-${idx}`}
                index={c.index}
                type="inclusion"
                status={c.status}
                criterion={c.criterion}
                evidence={c.evidence}
                reasoning={c.reasoning}
                filterType={c.filter_type}
                field={c.field}
              />
            ))}
          </div>
        </div>
        
        {exclusionCriteria.some(c => c.status !== 'loading') && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
              Exclusion Criteria
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '4px' }}>
              {exclusionCriteria.map((c, idx) => (
                <CriterionBox
                  key={`exc-${idx}`}
                  index={c.index}
                  type="exclusion"
                  status={c.status}
                  criterion={c.criterion}
                  evidence={c.evidence}
                  reasoning={c.reasoning}
                  filterType={c.filter_type}
                  field={c.field}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
