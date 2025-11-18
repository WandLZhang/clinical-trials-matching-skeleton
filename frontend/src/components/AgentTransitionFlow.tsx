import React, { useState, useEffect } from 'react';
import { ClinicalTrialsFlowDiagram } from './ClinicalTrialsFlowDiagram';
import './AgentTransitionFlow.css';

interface AgentTransitionFlowProps {
  onComplete?: () => void;
}

export const AgentTransitionFlow: React.FC<AgentTransitionFlowProps> = ({ onComplete }) => {
  const [trialData, setTrialData] = useState<any>(null);
  const [agent2Status, setAgent2Status] = useState<'searching' | 'processing' | 'complete'>('searching');
  const [totalPatients, setTotalPatients] = useState(0);
  const [processedPatients, setProcessedPatients] = useState(0);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [sseEvents, setSseEvents] = useState<Array<{ timestamp: string; data: any }>>([]);

  // Use refs to track ongoing requests and prevent duplicates
  const agent1RequestRef = React.useRef<AbortController | null>(null);
  const agent2RequestRef = React.useRef<AbortController | null>(null);

  // Simulate Agent 1 data fetching with proper cleanup
  useEffect(() => {
    // Cancel any previous request
    if (agent1RequestRef.current) {
      agent1RequestRef.current.abort();
    }

    const abortController = new AbortController();
    agent1RequestRef.current = abortController;

    const fetchTrialData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_AGENT1_URL;
        
        if (!apiUrl) {
          console.error('API URL not configured');
          return;
        }

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

        const data = await response.json();
        
        // Only update state if this request wasn't cancelled
        if (!abortController.signal.aborted) {
          setTrialData(data);
        }

      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Agent 1 request aborted');
        } else {
          console.error('Error fetching trial data:', err);
        }
      }
    };

    fetchTrialData();

    // Cleanup
    return () => {
      abortController.abort();
      if (agent1RequestRef.current === abortController) {
        agent1RequestRef.current = null;
      }
    };
  }, []);

  // Start Agent 2 when trial data is available
  useEffect(() => {
    if (!trialData) return;

    // Cancel any previous Agent 2 request
    if (agent2RequestRef.current) {
      agent2RequestRef.current.abort();
    }

    const apiUrl = import.meta.env.VITE_API_AGENT2_URL;
    
    if (!apiUrl) {
      console.error('Agent 2 API URL not configured');
      return;
    }

    const abortController = new AbortController();
    agent2RequestRef.current = abortController;

    // Reset state for new streaming session
    setAgent2Status('searching');
    setSseEvents([]);
    setTotalPatients(0);
    setProcessedPatients(0);
    setEligibleCount(0);
    setExcludedCount(0);

    const startStreaming = async () => {
      try {
        setAgent2Status('searching');
        setSseEvents([]); // Clear previous events
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trialData }),
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = ''; // Buffer for incomplete JSON

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const eventData = line.substring(6);
              processEvent(eventData);
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Stream aborted');
        } else {
          console.error('Streaming error:', error);
        }
      }
    };

    const processEvent = (eventData: string) => {
      try {
        const data = JSON.parse(eventData);
        const now = new Date();
        const timestamp = `${now.toLocaleTimeString('en-US', { hour12: false })}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        console.log(`[${timestamp}] SSE Event:`, data);

        // Store event with timestamp
        setSseEvents(prev => [...prev, { timestamp, data }]);

        switch (data.status) {
          case 'layer1_start':
            console.log(`[${timestamp}] Layer 1 starting...`);
            setAgent2Status('searching');
            break;

          case 'layer1_results':
            console.log(`[${timestamp}] Layer 1 results: ${data.totalPatients} patients found`);
            setTotalPatients(data.totalPatients || 0);
            setAgent2Status('processing');
            break;

          case 'processing_patient':
            // Just log the event, no patient state management
            break;

          case 'filter_result':
            // Just log the event, no patient state management
            break;

          case 'patient_eligibility':
            // Update aggregate counts
            if (data.eligibility === 'ELIGIBLE') {
              setEligibleCount(c => c + 1);
            } else if (data.eligibility !== 'REQUIRES_FOLLOW_UP') {
              setExcludedCount(c => c + 1);
            }
            setProcessedPatients(c => c + 1);
            break;

          case 'complete':
            setAgent2Status('complete');
            console.log('Patient matching complete:', data.summary);
            if (onComplete) {
              onComplete();
            }
            break;

          case 'error':
            console.error('SSE Error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    startStreaming();

    return () => {
      abortController.abort();
    };
  }, [trialData, onComplete]);

  const handleAgent1Complete = (data: any) => {
    setTrialData(data);
  };

  return (
    <div className="agent-transition-wrapper" style={{ width: '100%', height: '100vh' }}>
      <ClinicalTrialsFlowDiagram
        agent1Data={trialData}
        agent2Data={{
          totalPatients,
          processedPatients,
          eligibleCount,
          excludedCount,
          status: agent2Status,
          sseEvents,
        }}
        onAgent1Complete={handleAgent1Complete}
      />
    </div>
  );
};
