import React from 'react';
import { Handle, Position } from 'reactflow';
import './AgentBox.css';

interface PatientNodeData {
  patientId: string;
  eligibility?: 'ELIGIBLE' | 'EXCLUDED' | 'REQUIRES_FOLLOW_UP';
  isProcessing: boolean;
}

export const PatientNode: React.FC<{ data: PatientNodeData }> = ({ data }) => {
  const getBackgroundColor = () => {
    if (data.isProcessing) return '#FFFFFF';
    switch (data.eligibility) {
      case 'ELIGIBLE': return '#E8F5E9'; // Green 50
      case 'EXCLUDED': return '#FFEBEE'; // Red 50
      case 'REQUIRES_FOLLOW_UP': return '#FFF3E0'; // Orange 50
      default: return '#FFFFFF';
    }
  };

  const getBorderColor = () => {
    if (data.isProcessing) return 'transparent';
    switch (data.eligibility) {
      case 'ELIGIBLE': return '#4CAF50';
      case 'EXCLUDED': return '#f44336';
      case 'REQUIRES_FOLLOW_UP': return '#FF9800';
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
      case 'REQUIRES_FOLLOW_UP': return '?';
      default: return '';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Left} id="target-left" />
      <div 
        style={{
          backgroundColor: getBackgroundColor(),
          border: `2px solid ${getBorderColor()}`,
          borderRadius: '8px',
          padding: '12px 16px',
          minWidth: '140px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#202124',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ 
          fontSize: '10px', 
          opacity: 0.7,
          textAlign: 'center',
          wordBreak: 'break-all'
        }}>
          {data.patientId.substring(0, 12)}...
        </div>
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
      </div>
    </div>
  );
};
