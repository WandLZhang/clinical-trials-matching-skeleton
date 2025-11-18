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

  // Truncate evidence for display
  const truncateText = (text: string | undefined, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const tooltipContent = (
    <div>
      <p><strong>Criterion:</strong> {criterion}</p>
      <p><strong>Evidence:</strong> {evidence}</p>
      <p><strong>Reasoning:</strong> {reasoning}</p>
    </div>
  );

  return (
    <TooltipWrapper content={tooltipContent} position="bottom">
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: getBackgroundColor(),
          border: `1px solid ${getBorderColor()}`,
          borderRadius: '4px',
          fontSize: '11px',
          minHeight: '32px',
          fontFamily: 'monospace',
          cursor: 'pointer'
        }}
      >
        <span style={{ 
          fontSize: '14px',
        fontWeight: 'bold',
        color: getTextColor(),
        minWidth: '16px'
      }}>
        {getStatusIcon()}
      </span>
      
      {filterType && (
        <span style={{ 
          backgroundColor: filterType === 'FHIR_DIRECT' ? '#2196F3' : '#9C27B0',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 600
        }}>
          {filterType === 'FHIR_DIRECT' ? '🔍 FHIR' : '🤖 LLM'}
        </span>
      )}
      
      {field && (
        <span style={{ 
          color: '#1976D2',
          fontWeight: 600,
          fontSize: '10px'
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
      
      {evidence && status !== 'loading' && (
        <span style={{ 
          color: '#666',
          fontSize: '10px',
          fontStyle: 'italic',
          maxWidth: '200px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {truncateText(evidence, 40)}
        </span>
      )}
      </div>
    </TooltipWrapper>
  );
};
