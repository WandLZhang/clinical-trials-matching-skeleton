import React, { useEffect, useState } from 'react';
import { TooltipWrapper } from './TooltipWrapper';
import './AgentBox.css';

interface Agent1Props {
  onComplete: (data: any) => void;
  onNext?: () => void;
  showNextButton?: boolean;
}

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'thinking';
  message: string;
}

export const Agent1: React.FC<Agent1Props> = ({ onComplete, onNext, showNextButton = true }) => {
  const [status, setStatus] = useState<'loading' | 'complete' | 'error'>('loading');
  const [trialData, setTrialData] = useState({
    nctId: 'NCT06895057',
    title: '',
    inclusionCount: 0,
    exclusionCount: 0
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jsonResponse, setJsonResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { timestamp, type, message }]);
    
    // Also log to console for parity
    const prefix = type === 'thinking' ? '🤔' : type === 'success' ? '✓' : '';
    const logMessage = `[${timestamp}] ${prefix} ${message}`;
    
    if (type === 'success') {
      console.log(`%c${logMessage}`, 'color: #4CAF50');
    } else if (type === 'thinking') {
      console.log(`%c${logMessage}`, 'color: #FFC107');
    } else {
      console.log(`%c${logMessage}`, 'color: #9E9E9E');
    }
  };

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    
    const fetchTrialData = async () => {
      if (!isMounted) return;
      try {
        const apiUrl = import.meta.env.VITE_API_AGENT1_URL;
        
        if (!apiUrl) {
          throw new Error('API URL not configured');
        }

        addLog('info', 'Initializing Cloud Function call...');
        addLog('info', `Endpoint: ${apiUrl}`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        addLog('info', 'Calling ClinicalTrials.gov API v2...');
        addLog('info', 'Target NCT ID: NCT06895057');
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ nctId: 'NCT06895057' }),
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        addLog('success', 'ClinicalTrials.gov response received');
        addLog('info', 'Starting Gemini 2.5 Pro criteria parsing...');
        addLog('thinking', 'Thinking step 1: Analyzing trial structure');
        
        await new Promise(resolve => setTimeout(resolve, 400));
        
        addLog('thinking', 'Thinking step 2: Identifying inclusion criteria');
        addLog('thinking', 'Thinking step 3: Identifying exclusion criteria');
        
        await new Promise(resolve => setTimeout(resolve, 400));
        
        addLog('thinking', 'Thinking step 4: Cleaning and formatting');
        addLog('thinking', 'Thinking step 5: Structuring JSON output');

        const data = await response.json();
        
        addLog('success', 'Gemini parsing complete');
        addLog('success', `Extracted ${data.inclusion?.length || 0} inclusion criteria`);
        addLog('success', `Extracted ${data.exclusion?.length || 0} exclusion criteria`);
        
        // Stream JSON response character by character
        const jsonStr = JSON.stringify(data, null, 2);
        let currentJson = '';
        for (let i = 0; i < jsonStr.length; i++) {
          currentJson += jsonStr[i];
          setJsonResponse(currentJson);
          if (i % 5 === 0) { // Update every 5 characters for smoother animation
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
        // Add a delay to ensure React has rendered all state updates before triggering Agent 2
        await new Promise(resolve => setTimeout(resolve, 150));
        
        setTrialData({
          nctId: data.nctId,
          title: data.title,
          inclusionCount: data.inclusion?.length || 0,
          exclusionCount: data.exclusion?.length || 0
        });

        if (!isMounted) return;
        
        setStatus('complete');
        addLog('success', 'Processing complete');
        onComplete(data);

      } catch (err) {
        // Ignore abort errors (expected when component unmounts)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Fetch aborted (component unmounted)');
          return;
        }
        
        console.error('Error fetching trial data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
        addLog('info', `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    fetchTrialData();
    
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []); // Empty dependency array - only run once on mount

  return (
    <div className="agent-container">
      <div className="agent-box">
        <div className="agent-header">
          <span className="material-symbols-outlined agent-icon">search</span>
          <h2 className="title-large">Agent 1: Clinical Trial Retrieval</h2>
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
              {status === 'complete' ? 'check_circle' : status === 'error' ? 'error' : 'pending'}
            </span>
            <span 
              className="body-large" 
              style={
                status === 'complete' 
                  ? { color: '#4CAF50' } 
                  : status === 'loading'
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
              {status === 'complete' ? 'Retrieval Complete' : 
               status === 'error' ? 'Error occurred' :
               'Querying ClinicalTrials.gov...'}
            </span>
          </div>

          {error && (
            <div className="error-message" style={{ 
              color: 'var(--md-sys-color-error)', 
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '8px',
              backgroundColor: 'var(--md-sys-color-error-container)'
            }}>
              <p className="body-medium">{error}</p>
            </div>
          )}

          <div className="trial-info">
            <p className="body-medium info-label">Trial ID:</p>
            <p className="body-large info-value">{trialData.nctId}</p>
          </div>

          {/* Two-column layout for logs and JSON */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '16px', 
            margin: '12px 0 6px 0',
            height: '320px'
          }}>
            {/* Left: Execution Logs */}
            <div
              style={{ 
                backgroundColor: '#1e1e1e', 
                borderRadius: '8px', 
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '12px',
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
                content={logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n')}
                position="bottom"
              >
                <div style={{ flex: 1, overflow: 'auto', cursor: 'pointer' }}>
                  {logs.map((log, index) => (
                    <div key={index} style={{ 
                      marginBottom: '8px',
                      color: log.type === 'success' ? '#4CAF50' : 
                             log.type === 'thinking' ? '#FFC107' : '#9E9E9E',
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <span style={{ opacity: 0.7 }}>[{log.timestamp}]</span>
                      <span>
                        {log.type === 'thinking' && '🤔 '}
                        {log.type === 'success' && '✓ '}
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </TooltipWrapper>
            </div>

            {/* Right: JSON Response */}
            <div
              style={{ 
                backgroundColor: '#1e1e1e', 
                borderRadius: '8px', 
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '12px',
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
                <div style={{ color: '#2196F3', fontWeight: 'bold' }}>
                  JSON Response
                </div>
              </div>
              <TooltipWrapper content={jsonResponse} position="left">
                <div style={{ flex: 1, overflow: 'auto', cursor: 'pointer' }}>
                  <pre style={{ 
                    margin: 0, 
                    color: '#E0E0E0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {jsonResponse}
                  </pre>
                </div>
              </TooltipWrapper>
            </div>
          </div>

          {/* Bottom: Next Button */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            {status === 'complete' && showNextButton && onNext && (
              <button 
                onClick={() => {
                  if (onNext) {
                    onNext();
                  }
                }}
                style={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '12px 32px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: 'Roboto, sans-serif',
                  letterSpacing: '0.1px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1565c0';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1976d2';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Next
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    arrow_forward
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
