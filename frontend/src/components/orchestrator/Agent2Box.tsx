import React, { useEffect, useRef } from 'react';
import '../AgentBox.css';

interface Agent2BoxProps {
  totalPatients: number;
  processedPatients: number;
  eligibleCount: number;
  excludedCount: number;
  status: 'searching' | 'processing' | 'complete';
  sseEvents: Array<{ timestamp: string; data: any }>;
}

export const Agent2Box: React.FC<Agent2BoxProps> = ({
  totalPatients,
  processedPatients,
  eligibleCount,
  excludedCount,
  status,
  sseEvents
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sseEvents]);

  const getStatusDisplay = () => {
    if (status === 'complete') return 'Matching Complete';
    if (status === 'processing') return 'Evaluating Patients...';
    return 'Searching FHIR Store...';
  };

  const progress = totalPatients > 0 ? (processedPatients / totalPatients) * 100 : 0;

  return (
    <div className="agent-container">
      <div className="agent-box">
        <div className="agent-header">
          <span className="material-symbols-outlined agent-icon">search</span>
          <h2 className="title-large">Agent 2: EHR Matching</h2>
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
                  : status === 'searching' || status === 'processing'
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

          {totalPatients > 0 && (
            <div className="trial-info">
              <p className="body-medium info-label">Patient Progress:</p>
              <div style={{ marginTop: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '4px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  <span>{processedPatients} / {totalPatients} processed</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#E0E0E0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #1976D2, #42A5F5)',
                    transition: 'width 0.3s ease',
                    animation: status === 'processing' ? 'shimmer 2s linear infinite' : 'none',
                    backgroundSize: '200% 100%'
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Full-width Raw SSE Event Logs */}
          <div style={{ 
            margin: '12px 0 6px 0',
            height: '400px'
          }}>
            <div 
              className="nopan"
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
              <div style={{ color: '#4CAF50', marginBottom: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                Raw SSE Events
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {sseEvents.map((event, index) => (
                  <div key={index} style={{ 
                    marginBottom: '8px',
                    color: '#9E9E9E',
                    display: 'flex',
                    gap: '8px',
                    borderBottom: '1px solid #333',
                    paddingBottom: '4px'
                  }}>
                    <span style={{ opacity: 0.7, minWidth: '80px' }}>[{event.timestamp}]</span>
                    <span style={{ 
                      color: event.data.status === 'complete' ? '#4CAF50' : 
                             event.data.status === 'error' ? '#f44336' :
                             event.data.status?.includes('layer1') ? '#2196F3' :
                             event.data.status === 'filter_result' ? '#FFC107' :
                             '#9E9E9E'
                    }}>
                      {event.data.status}:
                    </span>
                    <pre style={{ 
                      margin: 0, 
                      color: '#E0E0E0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      flex: 1
                    }}>
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
