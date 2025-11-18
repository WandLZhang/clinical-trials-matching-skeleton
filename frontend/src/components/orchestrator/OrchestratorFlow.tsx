import React, { useState, useEffect } from 'react';
import { Agent2Box } from './Agent2Box';
import './orchestrator.css';

interface OrchestratorFlowProps {
  trialData: any;
  onComplete?: () => void;
}

export const OrchestratorFlow: React.FC<OrchestratorFlowProps> = ({
  trialData,
  onComplete
}) => {
  const [agent2Status, setAgent2Status] = useState<'searching' | 'processing' | 'complete'>('searching');
  const [sseEvents, setSseEvents] = useState<Array<{ timestamp: string; data: any }>>([]);
  
  // Use ref to track ongoing request
  const abortControllerRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const apiUrl = import.meta.env.VITE_API_AGENT2_URL;
    
    if (!apiUrl) {
      console.error('Agent 2 API URL not configured');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Use fetch with streaming instead of EventSource (which only supports GET)
    const startStreaming = async () => {
      try {
        setAgent2Status('searching');
        
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

        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            break;
          }

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          
          // Split by newlines and process each event
          const lines = chunk.split('\n');
          
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
        
        // Track all SSE events for raw display
        const now = new Date();
        const timestamp = `${now.toLocaleTimeString('en-US', { hour12: false })}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        console.log(`[${timestamp}] SSE Event:`, data);
        setSseEvents(prev => [...prev, { timestamp, data }]);

        switch (data.status) {
          case 'layer1_start':
            setAgent2Status('searching');
            break;

          case 'layer1_complete':
            console.log('Search query constructed:', data.query);
            break;

          case 'searching':
            console.log('Searching FHIR store...');
            break;

          case 'layer1_results':
            setAgent2Status('processing');
            console.log('Processing patients:', data.totalPatients);
            break;

          case 'filter_result':
            // Just log the filter results
            console.log('Filter result:', data);
            break;

          case 'patient_eligibility':
            // Just log the patient eligibility
            console.log('Processing patient_eligibility for:', data.patientId);
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

    // Cleanup
    return () => {
      abortController.abort();
    };
  }, [trialData, onComplete]);

  return (
    <div className="orchestrator-flow">
      <div className="orchestrator-container">
        <Agent2Box
          status={agent2Status}
          sseEvents={sseEvents}
        />
      </div>
    </div>
  );
};
