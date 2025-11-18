import React, { useEffect, useRef, useState } from 'react';
import { TooltipWrapper } from '../TooltipWrapper';
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
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const innerScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom within the container only
  useEffect(() => {
    if (innerScrollRef.current) {
      innerScrollRef.current.scrollTop = innerScrollRef.current.scrollHeight;
    }
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
                    const isFilterResult = data.status === 'filter_result';
                    const isPatientEligibility = data.status === 'patient_eligibility';
                    
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
                                   data.status?.includes('layer1') ? '#2196F3' :
                                   data.status === 'filter_result' ? '#FFC107' :
                                   data.status === 'patient_eligibility' ? '#9C27B0' :
                                   '#9E9E9E'
                          }}>
                            {data.status}
                          </span>
                        </div>

                        {/* Enhanced display for filter_result events */}
                        {isFilterResult && (
                          <div style={{ marginLeft: '88px', fontSize: '11px' }}>
                            {data.patient_id && (
                              <div style={{ color: '#64B5F6', marginBottom: '2px' }}>
                                Patient: {data.patient_id.substring(0, 12)}...
                              </div>
                            )}
                            {data.criterion && (
                              <div style={{ color: '#FFF59D', marginBottom: '2px' }}>
                                <strong>Criterion [{data.criterion_index}]:</strong> {data.criterion}
                              </div>
                            )}
                            {data.filter_type && (
                              <div style={{ color: '#81C784', marginBottom: '2px' }}>
                                <strong>Type:</strong> {data.filter_type === 'FHIR_DIRECT' ? '🔍 FHIR_DIRECT' : '🤖 SEMANTIC'}
                                {data.field && ` (${data.field})`}
                              </div>
                            )}
                            {data.message && (
                              <div style={{ color: '#FFB74D', marginBottom: '2px' }}>
                                <strong>Message:</strong> {data.message}
                              </div>
                            )}
                            {data.result && (
                              <div style={{ 
                                color: data.result === 'PASS' ? '#4CAF50' : 
                                       data.result === 'FAIL' ? '#f44336' : 
                                       data.result === 'MISSING' ? '#FF9800' : '#9E9E9E',
                                marginBottom: '2px'
                              }}>
                                <strong>Result:</strong> {data.result}
                              </div>
                            )}
                            {data.evidence && (
                              <div style={{ color: '#90CAF9', marginBottom: '2px' }}>
                                <strong>Evidence:</strong> {data.evidence}
                              </div>
                            )}
                            {data.reasoning && (
                              <div style={{ color: '#CE93D8', marginBottom: '2px' }}>
                                <strong>Reasoning:</strong> {data.reasoning}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Enhanced display for patient_eligibility events */}
                        {isPatientEligibility && (
                          <div style={{ marginLeft: '88px', fontSize: '11px' }}>
                            {data.patientId && (
                              <div style={{ color: '#64B5F6', marginBottom: '2px' }}>
                                Patient: {data.patientId.substring(0, 12)}...
                              </div>
                            )}
                            {data.eligibility && (
                              <div style={{ 
                                color: data.eligibility === 'ELIGIBLE' ? '#4CAF50' : 
                                       data.eligibility === 'EXCLUDED' ? '#f44336' : '#FF9800',
                                marginBottom: '2px'
                              }}>
                                <strong>Eligibility:</strong> {data.eligibility}
                              </div>
                            )}
                            {data.reason_type && (
                              <div style={{ color: '#FFB74D', marginBottom: '2px' }}>
                                <strong>Reason Type:</strong> {data.reason_type}
                              </div>
                            )}
                            {data.patient_result?.follow_up_items && data.patient_result.follow_up_items.length > 0 && (
                              <div style={{ color: '#FF9800', marginBottom: '2px' }}>
                                <strong>Follow-up Items ({data.patient_result.follow_up_items.length}):</strong>
                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                  {data.patient_result.follow_up_items.slice(0, 3).map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                  {data.patient_result.follow_up_items.length > 3 && (
                                    <li>... and {data.patient_result.follow_up_items.length - 3} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fallback: Show raw JSON for other event types */}
                        {!isFilterResult && !isPatientEligibility && (
                          <pre style={{ 
                            margin: '0 0 0 88px', 
                            color: '#E0E0E0',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '11px'
                          }}>
                            {JSON.stringify(data, null, 2)}
                          </pre>
                        )}
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
