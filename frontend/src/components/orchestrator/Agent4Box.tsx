import React, { useEffect, useRef } from 'react';
import { TooltipWrapper } from '../TooltipWrapper';
import '../AgentBox.css';

interface Agent4BoxProps {
  status: 'waiting' | 'processing' | 'complete';
  sseEvents: Array<{ timestamp: string; data: any }>;
}

export const Agent4Box: React.FC<Agent4BoxProps> = ({
  status,
  sseEvents
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const innerScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom within the container only
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sseEvents]);

  const getStatusDisplay = () => {
    if (status === 'complete') return 'Paperwork Generation Complete';
    if (status === 'processing') return 'Generating Documents...';
    return 'Waiting for Matches...';
  };

  return (
    <div className="agent-container">
      <div className="agent-box">
        <div className="agent-header">
          <span className="material-symbols-outlined agent-icon">description</span>
          <h2 className="title-large">Final Agent: Enrollment Paperwork</h2>
        </div>

        <div className="agent-content">
          <div className="agent-status" style={
            status === 'complete' ? {
              background: 'linear-gradient(90deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%)',
              border: '1px solid rgba(76, 175, 80, 0.3)'
            } : undefined
          }>
            <span className="material-symbols-outlined status-icon" style={
              status === 'complete' ? { color: '#4CAF50' } : undefined
            }>
              {status === 'complete' ? 'check_circle' : 'pending'}
            </span>
            <span 
              className="body-large" 
              style={
                status === 'complete' 
                  ? { color: '#4CAF50' } 
                  : status === 'processing'
                    ? {
                        background: 'linear-gradient(90deg, #666 0%, #999 50%, #666 100%)',
                        backgroundSize: '200% auto',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'shimmer 2s linear infinite'
                      }
                    : undefined
              }
            >
              {getStatusDisplay()}
            </span>
          </div>

          {/* Full-width Execution Logs */}
          <div style={{ 
            margin: '12px 0 6px 0',
            height: '400px'
          }}>
            <div 
              ref={logsContainerRef}
              style={{ 
                backgroundColor: '#1e1e1e', 
                borderRadius: '8px', 
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '11px',
                overflow: 'auto',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ 
                marginBottom: '12px',
                flexShrink: 0 
              }}>
                <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                  Execution Logs
                </div>
              </div>
              <TooltipWrapper
                content={<pre>{JSON.stringify(sseEvents.map(e => e.data), null, 2)}</pre>}
                position="left"
              >
                <div ref={innerScrollRef} style={{ flex: 1, overflow: 'auto', cursor: 'pointer' }}>
                  {sseEvents.map((event, index) => {
                    const data = event.data;
                    
                    return (
                      <div key={index} style={{ 
                        marginBottom: '12px',
                        borderBottom: '1px solid #444',
                        paddingBottom: '8px'
                      }}>
                        {/* Timestamp and Status */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ opacity: 0.7, minWidth: '80px', color: '#888' }}>
                            [{event.timestamp}]
                          </span>
                          <span style={{ 
                            fontWeight: 'bold',
                            color: data.status === 'complete' ? '#4CAF50' : 
                                   data.status === 'error' ? '#f44336' :
                                   '#2196F3'
                          }}>
                            {data.status || 'INFO'}
                          </span>
                        </div>

                        <pre style={{ 
                          margin: '0 0 0 88px', 
                          color: '#E0E0E0',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '11px'
                        }}>
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              </TooltipWrapper>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
