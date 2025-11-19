import React from 'react';
import { Handle, Position } from 'reactflow';
import { TooltipWrapper } from './TooltipWrapper';

interface FolderNodeData {
  patientId: string;
  folderUrl: string;
  label?: string;
}

export const FolderNode: React.FC<{ data: FolderNodeData }> = ({ data }) => {
  const handleClick = () => {
    if (data.folderUrl) {
      window.open(data.folderUrl, '_blank');
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Handle type="target" position={Position.Left} id="target-left" />
      
      <TooltipWrapper content={`Open Patient Folder: ${data.patientId}`} position="top">
        <div 
          onClick={handleClick}
          style={{
            backgroundColor: '#E3F2FD', // Light Blue
            border: '2px solid #2196F3',
            borderRadius: '8px',
            padding: '12px',
            width: '120px',
            height: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          }}
        >
          <span className="material-symbols-outlined" style={{ color: '#1976D2', fontSize: '24px' }}>
            folder_open
          </span>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1565C0' }}>
            {data.patientId.substring(0, 8)}...
          </span>
        </div>
      </TooltipWrapper>
    </div>
  );
};
