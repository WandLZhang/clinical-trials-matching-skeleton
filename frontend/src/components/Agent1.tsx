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
  const abortControllerRef = React.useRef<AbortController | null>(null);

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
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    let isMounted = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    const fetchTrialData = async () => {
      if (!isMounted) return;
      try {
        const apiUrl = import.meta.env.VITE_API_AGENT1_URL;
        
        if (!apiUrl) {
          throw new Error('API URL not configured');
        }

        addLog('info', 'Initializing Cloud Function call...');
        addLog('info', `Endpoint: ${apiUrl}`);
        
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

        if (!response.body) {
          throw new Error('Response body is empty');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        let baseTrialData: any = {};
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and split by newline
          const chunkStr = decoder.decode(value, { stream: true });
          buffer += chunkStr;
          const lines = buffer.split('\n');
          
          // Process all complete lines
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              // console.log('Processing line:', line); // Optional debug
              const data = JSON.parse(line);
              
              if (data.status) {
                if (data.status === 'error') {
                  throw new Error(data.message);
                }
                // Map status messages to log types
                const logType = data.status === 'success' ? 'success' : 'info';
                addLog(logType, data.message);
              } 
              else if (data.type === 'base_data') {
                baseTrialData = data.data;
                setTrialData(prev => ({
                  ...prev,
                  nctId: data.data.nctId,
                  title: data.data.title
                }));
              }
              else if (data.candidates && Array.isArray(data.candidates)) {
                // Handle Gemini streaming chunks
                for (const candidate of data.candidates) {
                  if (candidate.content && candidate.content.parts) {
                    for (const part of candidate.content.parts) {
                      if (part.thought) {
                        // It's a thought - log it
                        // Based on testing, thought content is in part.text when part.thought is true
                        const thoughtText = part.text || JSON.stringify(part.thought);
                        addLog('thinking', thoughtText);
                      } else if (part.text) {
                        // It's the actual response text
                        fullResponseText += part.text;
                        setJsonResponse(fullResponseText);
                      }
                    }
                  }
                }
              }
              else if (data.type === 'final_result') {
                // Handle explicit empty result if any
                fullResponseText = JSON.stringify(data.data);
                setJsonResponse(fullResponseText);
              }
            } catch (e) {
              console.warn('Error parsing chunk:', e);
            }
          }
        }

        // Stream complete - clean up and parse the final JSON
        // Remove markdown code blocks if present
        let jsonStr = fullResponseText.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        
        // Clean up any remaining whitespace or invalid characters
        jsonStr = jsonStr.trim();
        
        if (!jsonStr) {
             throw new Error("Empty response received from Gemini");
        }

        let parsedCriteria;
        try {
          parsedCriteria = JSON.parse(jsonStr);
        } catch (e) {
          console.error('Error parsing final JSON:', e);
          console.log('Raw string:', jsonStr);
          throw new Error('Failed to parse Gemini response');
        }
        
        addLog('success', 'Gemini parsing complete');
        addLog('success', `Extracted ${parsedCriteria.inclusion?.length || 0} inclusion criteria`);
        addLog('success', `Extracted ${parsedCriteria.exclusion?.length || 0} exclusion criteria`);

        // Merge base data with parsed criteria
        const finalData = {
          ...baseTrialData,
          inclusion: parsedCriteria.inclusion || [],
          exclusion: parsedCriteria.exclusion || [],
          criteriaCount: (parsedCriteria.inclusion?.length || 0) + (parsedCriteria.exclusion?.length || 0)
        };

        setTrialData({
          nctId: finalData.nctId,
          title: finalData.title,
          inclusionCount: finalData.inclusion.length,
          exclusionCount: finalData.exclusion.length
        });

        if (!isMounted) return;
        
        setStatus('complete');
        addLog('success', 'Processing complete');
        onComplete(finalData);

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
