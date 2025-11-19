import React from 'react';
import { Handle, Position } from 'reactflow';
import { TooltipWrapper } from './TooltipWrapper';
import { PatientSearchTooltip } from './PatientSearchTooltip';
import './AgentBox.css';

interface PatientEvaluation {
  criterionText: string;
  criterionType: 'INCLUSION' | 'EXCLUSION';
  criterionIndex: number;
  result: 'PASS' | 'FAIL' | 'MISSING' | 'UNCLEAR' | null;
  reasoning: string;
  evidence: string;
  filterType: 'SEMANTIC' | 'FHIR_DIRECT';
  timestamp: string;
}

interface PatientNodeData {
  patientId: string;
  eligibility?: 'ELIGIBLE' | 'EXCLUDED' | 'REQUIRES_FOLLOW_UP';
  isProcessing: boolean;
  evaluations?: { [criterionId: string]: PatientEvaluation };
}

export const PatientNode: React.FC<{ data: PatientNodeData }> = ({ data }) => {
  const getBackgroundColor = () => {
    if (data.isProcessing) return '#FFFFFF';
    switch (data.eligibility) {
      case 'ELIGIBLE': return '#E8F5E9'; // Green 50
      case 'EXCLUDED': return '#FFEBEE'; // Red 50
      case 'REQUIRES_FOLLOW_UP': return '#F1F8E9'; // Light Green (same family as Eligible but maybe distinct? Using standard light green)
      default: return '#FFFFFF';
    }
  };

  const getBorderColor = () => {
    if (data.isProcessing) return 'transparent';
    switch (data.eligibility) {
      case 'ELIGIBLE': return '#4CAF50';
      case 'EXCLUDED': return '#f44336';
      case 'REQUIRES_FOLLOW_UP': return '#8BC34A'; // Light Green border
      default: return '#555';
    }
  };

  const getStatusIcon = () => {
    if (data.isProcessing) {
      return <div className="spinner" />;
    }
    switch (data.eligibility) {
      case 'ELIGIBLE': return '✓';
      case 'EXCLUDED': return '✗';
      case 'REQUIRES_FOLLOW_UP': return null;
      default: return '';
    }
  };

  // Helper to sort evaluations
  const getSortedEvaluations = (type: 'INCLUSION' | 'EXCLUSION') => {
    if (!data.evaluations) return [];
    return Object.values(data.evaluations)
      .filter(e => e.criterionType === type)
      .sort((a, b) => a.criterionIndex - b.criterionIndex);
  };

  const inclusionCriteria = getSortedEvaluations('INCLUSION');
  const exclusionCriteria = getSortedEvaluations('EXCLUSION');

  // Helper to render a single criterion box
  const renderCriterionBox = (evaluation: PatientEvaluation) => {
    let backgroundColor = 'transparent';
    let borderColor = '#ddd'; // Default grey border for loading/pending
    let pulseAnimation = '';

    if (evaluation.result === null || evaluation.result === undefined) {
      // Loading state
      pulseAnimation = 'pulse-grey';
      backgroundColor = '#E0E0E0'; // Grey 300
      borderColor = '#BDBDBD'; // Grey 400
    } else if (evaluation.result === 'MISSING') {
      backgroundColor = '#FF9800'; // Orange for missing data
      borderColor = '#F57C00';
    } else if (evaluation.result === 'UNCLEAR') {
      backgroundColor = '#FFEB3B'; // Yellow for unclear data
      borderColor = '#FBC02D';
    } else {
      // Logic for Good vs Bad
      // Inclusion: PASS = Good (Green), FAIL = Bad (Red)
      // Exclusion: FAIL = Good (Green - not excluded), PASS = Bad (Red - excluded)
      
      const isGood = 
        (evaluation.criterionType === 'INCLUSION' && evaluation.result === 'PASS') ||
        (evaluation.criterionType === 'EXCLUSION' && evaluation.result === 'FAIL');
      
      backgroundColor = isGood ? '#4CAF50' : '#f44336';
      borderColor = isGood ? '#388E3C' : '#D32F2F';
    }

    // Tooltip content
    const tooltipContent = (
      <div style={{ maxWidth: '300px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#fff' }}>
          {evaluation.criterionType} #{evaluation.criterionIndex + 1}
        </div>
        <div style={{ marginBottom: '8px', fontStyle: 'italic', color: '#ddd' }}>
          "{evaluation.criterionText}"
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>Result:</strong> <span style={{ 
            color: evaluation.result === 'PASS' ? '#69F0AE' : 
                   evaluation.result === 'FAIL' ? '#FF5252' : 
                   evaluation.result === 'UNCLEAR' ? '#FFEB3B' : '#FFAB40' 
          }}>{evaluation.result || 'PENDING'}</span>
        </div>
        {evaluation.reasoning && (
          <div>
            <strong>Reasoning:</strong> {evaluation.reasoning}
          </div>
        )}
      </div>
    );

    return (
      <TooltipWrapper key={`${evaluation.criterionType}-${evaluation.criterionIndex}`} content={tooltipContent} position="top">
        <div 
          style={{
            width: '12px',
            height: '12px',
            backgroundColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '2px',
            cursor: 'help',
            animation: pulseAnimation ? 'pulse-opacity 1.5s infinite ease-in-out' : 'none',
            transition: 'background-color 0.3s ease'
          }}
        />
      </TooltipWrapper>
    );
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Right} id="source-right" style={{ opacity: 0 }} />
      
      {/* Main Patient Box */}
      <TooltipWrapper 
        content={<PatientSearchTooltip patientId={data.patientId} />} 
        position="right"
        delay={500} // Longer delay so it doesn't pop up instantly
      >
        <div 
          style={{
            backgroundColor: getBackgroundColor(),
            border: `2px solid ${getBorderColor()}`,
            borderRadius: '8px',
            padding: '12px 16px',
            width: '140px', // Fixed width
            height: '74px', // Fixed height to ensure alignment
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#202124',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s ease',
            marginRight: '12px', // Spacing between box and criteria
            zIndex: 10,
            cursor: 'context-menu'
          }}
        >
          <div style={{ 
            fontSize: '10px', 
            opacity: 0.7,
            textAlign: 'center',
            wordBreak: 'break-all',
            flex: data.eligibility === 'REQUIRES_FOLLOW_UP' ? 1 : 'none',
            display: data.eligibility === 'REQUIRES_FOLLOW_UP' ? 'flex' : 'block',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {data.patientId.substring(0, 12)}...
          </div>
          {data.eligibility !== 'REQUIRES_FOLLOW_UP' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '24px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: getBorderColor()
            }}>
              {getStatusIcon()}
            </div>
          )}
        </div>
      </TooltipWrapper>

      {/* Criteria "DNA Strip" Container */}
      {data.evaluations && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px',
          justifyContent: 'center',
          height: '100%' // Match height context
        }}>
          {/* Top Row: Inclusion Criteria */}
          {inclusionCriteria.length > 0 && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {inclusionCriteria.map(renderCriterionBox)}
            </div>
          )}

          {/* Bottom Row: Exclusion Criteria */}
          {exclusionCriteria.length > 0 && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {exclusionCriteria.map(renderCriterionBox)}
            </div>
          )}
        </div>
      )}
      
      <style>
        {`
          @keyframes pulse-opacity {
            0% { opacity: 0.3; }
            50% { opacity: 0.7; }
            100% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
};
