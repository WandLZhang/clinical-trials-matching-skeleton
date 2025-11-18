import React from 'react';
import { TooltipWrapper } from '../TooltipWrapper';
import './orchestrator.css';

interface CriterionBoxProps {
  index: number;
  type: 'inclusion' | 'exclusion';
  status: 'loading' | 'pass' | 'fail' | 'unclear';
  criterion?: string;
  evidence?: string;
  reasoning?: string;
  filterType?: string;
  field?: string;
}

export const CriterionBox: React.FC<CriterionBoxProps> = ({
  index,
  type,
  status,
  criterion,
  evidence,
  reasoning,
  filterType,
  field
}) => {
  const getStatusIcon = () => {
    if (status === 'loading') {
      return (
        <span style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          border: '2px solid #9E9E9E',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      );
    }
    
    switch (status) {
      case 'pass':
        return '✓';
      case 'fail':
        return '✗';
      default:
        return '?';
    }
  };

  const getBackgroundColor = () => {
    switch (status) {
      case 'pass':
        return 'rgba(76, 175, 80, 0.1)';
      case 'fail':
        return 'rgba(244, 67, 54, 0.1)';
      case 'loading':
        return 'rgba(158, 158, 158, 0.05)';
      default:
        return 'rgba(255, 193, 7, 0.1)';
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case 'pass':
        return '#4CAF50';
      case 'fail':
        return '#f44336';
      case 'loading':
        return '#9E9E9E';
      default:
        return '#FFC107';
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'pass':
        return '#2E7D32';
      case 'fail':
        return '#C62828';
      case 'loading':
        return '#666';
      default:
        return '#F57C00';
    }
  };

  const tooltipContent = (
    <div style={{ maxWidth: '500px', fontSize: '12px', lineHeight: '1.5' }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', color: '#1976D2', marginBottom: '4px' }}>
          {type === 'inclusion' ? 'INCLUSION' : 'EXCLUSION'} Criterion #{index + 1}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>
          {criterion || 'Loading...'}
        </div>
      </div>
      
      {filterType && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ 
            fontWeight: 'bold', 
            color: filterType === 'FHIR_DIRECT' ? '#2196F3' : '#9C27B0',
            marginRight: '4px'
          }}>
            Filter Type:
          </span>
          <span>{filterType === 'FHIR_DIRECT' ? '🔍 FHIR Direct' : '🤖 Semantic (AI)'}</span>
        </div>
      )}
      
      {field && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontWeight: 'bold', marginRight: '4px' }}>Field:</span>
          <code style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '2px 6px', 
            borderRadius: '3px',
            fontSize: '11px'
          }}>
            {field}
          </code>
        </div>
      )}
      
      {evidence && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Evidence:</div>
          <div style={{ 
            backgroundColor: '#f9f9f9', 
            padding: '6px 8px', 
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {evidence}
          </div>
        </div>
      )}
      
      {reasoning && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Reasoning:</div>
          <div style={{ 
            backgroundColor: '#f0f7ff', 
            padding: '6px 8px', 
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {reasoning}
          </div>
        </div>
      )}
      
      <div style={{ 
        marginTop: '10px', 
        paddingTop: '8px', 
        borderTop: '1px solid #e0e0e0',
        fontSize: '11px',
        color: '#666'
      }}>
        <span style={{ fontWeight: 'bold', marginRight: '4px' }}>Result:</span>
        <span style={{ 
          color: status === 'pass' ? '#2E7D32' : status === 'fail' ? '#C62828' : '#F57C00',
          fontWeight: 'bold'
        }}>
          {status === 'pass' ? '✓ PASS' : status === 'fail' ? '✗ FAIL' : '? UNCLEAR/MISSING'}
        </span>
      </div>
    </div>
  );

  return (
    <TooltipWrapper content={tooltipContent} position="bottom">
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          backgroundColor: getBackgroundColor(),
          border: `1px solid ${getBorderColor()}`,
          borderRadius: '4px',
          fontSize: '10px',
          minHeight: '24px',
          fontFamily: 'monospace',
          cursor: 'pointer'
        }}
      >
        <span style={{ 
          fontSize: '12px',
        fontWeight: 'bold',
        color: getTextColor(),
        minWidth: '14px'
      }}>
        {getStatusIcon()}
      </span>
      
      {filterType && (
        <span style={{ 
          backgroundColor: filterType === 'FHIR_DIRECT' ? '#2196F3' : '#9C27B0',
          color: 'white',
          padding: '1px 4px',
          borderRadius: '3px',
          fontSize: '8px',
          fontWeight: 600
        }}>
          {filterType === 'FHIR_DIRECT' ? '🔍' : '🤖'}
        </span>
      )}
      
      {field && (
        <span style={{ 
          color: '#1976D2',
          fontWeight: 600,
          fontSize: '9px'
        }}>
          {field}
        </span>
      )}
      
      <span style={{ 
        flex: 1,
        color: '#333',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {criterion || `Criterion ${index + 1}`}
      </span>
      </div>
    </TooltipWrapper>
  );
};
