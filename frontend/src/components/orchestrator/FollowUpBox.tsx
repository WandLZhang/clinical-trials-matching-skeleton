import React, { useState } from 'react';
import './orchestrator.css';

interface FollowUpBoxProps {
  patientId: string;
  followUpItems: string[];
}

export const FollowUpBox: React.FC<FollowUpBoxProps> = ({
  patientId,
  followUpItems
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = () => {
    const text = `Patient ${patientId}\n\nFollow-up Items:\n${followUpItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div style={{
      backgroundColor: '#FFF3E0',
      border: '2px solid #FF9800',
      borderRadius: '8px',
      padding: '12px',
      minWidth: '300px',
      maxWidth: '400px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 600,
          color: '#E65100'
        }}>
          ⚠ Requires Follow-Up
        </div>
        <button
          onClick={copyToClipboard}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          style={{
            background: copySuccess ? '#4CAF50' : '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Copy follow-up items to clipboard"
        >
          {copySuccess ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
        Missing data for:
      </div>
      
      <ul style={{ 
        margin: 0, 
        paddingLeft: '20px',
        fontSize: '11px',
        color: '#333',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        {followUpItems.map((item, index) => (
          <li key={index} style={{ marginBottom: '4px' }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};
