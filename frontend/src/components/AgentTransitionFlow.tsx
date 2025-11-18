import React, { useState, useEffect } from 'react';
import { ClinicalTrialsFlowDiagram } from './ClinicalTrialsFlowDiagram';
import './AgentTransitionFlow.css';

interface AgentTransitionFlowProps {
  onComplete?: () => void;
}

interface CriterionState {
  index: number;
  type: 'inclusion' | 'exclusion';
  status: 'loading' | 'pass' | 'fail' | 'unclear';
  criterion?: string;
  evidence?: string;
  reasoning?: string;
}

interface PatientState {
  patientId: string;
  status: 'loading' | 'eligible' | 'excluded' | 'requires_followup';
  criteria: CriterionState[];
}

export const AgentTransitionFlow: React.FC<AgentTransitionFlowProps> = ({ onComplete }) => {
  const [trialData, setTrialData] = useState<any>(null);
  const [agent2Status, setAgent2Status] = useState<'searching' | 'processing' | 'complete'>('searching');
  const [patients, setPatients] = useState<Map<string, PatientState>>(new Map());
  const [totalPatients, setTotalPatients] = useState(0);
  const [processedPatients, setProcessedPatients] = useState(0);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [sseEvents, setSseEvents] = useState<Array<{ timestamp: string; data: any }>>([]);

  const inclusionCount = trialData?.inclusion?.length || 0;
  const exclusionCount = trialData?.exclusion?.length || 0;

  // Simulate Agent 1 data fetching
  useEffect(() => {
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
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setTrialData(data);

      } catch (err) {
        console.error('Error fetching trial data:', err);
      }
    };

    fetchTrialData();
  }, []);

  // Start Agent 2 when trial data is available
  useEffect(() => {
    if (!trialData) return;

    const apiUrl = import.meta.env.VITE_API_AGENT2_URL;
    
    if (!apiUrl) {
      console.error('Agent 2 API URL not configured');
      return;
    }

    const abortController = new AbortController();

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
            
            // Immediately spawn all patient boxes with pre-populated loading criteria
            if (data.patientIds && Array.isArray(data.patientIds)) {
              console.log(`[${timestamp}] Creating ${data.patientIds.length} patient boxes with loading criteria...`);
              setPatients(prev => {
                const newPatients = new Map(prev);
                data.patientIds.forEach((patientId: string) => {
                  // Pre-populate all inclusion and exclusion criteria in loading state
                  const initialCriteria: CriterionState[] = [];
                  
                  // Add all inclusion criteria
                  for (let i = 0; i < inclusionCount; i++) {
                    initialCriteria.push({
                      index: i,
                      type: 'inclusion',
                      status: 'loading'
                    });
                  }
                  
                  // Add all exclusion criteria
                  for (let i = 0; i < exclusionCount; i++) {
                    initialCriteria.push({
                      index: i,
                      type: 'exclusion',
                      status: 'loading'
                    });
                  }
                  
                  newPatients.set(patientId, {
                    patientId,
                    status: 'loading',
                    criteria: initialCriteria
                  });
                });
                console.log(`[${timestamp}] Patient boxes created:`, newPatients.size);
                return newPatients;
              });
            }
            break;

          case 'processing_patient':
            setPatients(prev => {
              const newPatients = new Map(prev);
              newPatients.set(data.patientId, {
                patientId: data.patientId,
                status: 'loading',
                criteria: []
              });
              return newPatients;
            });
            break;

          case 'filter_result':
            setPatients(prev => {
              const newPatients = new Map(prev);
              const patient = newPatients.get(data.patientId);
              
              if (patient) {
                const criteriaType = data.criterion_type === 'INCLUSION' ? 'inclusion' : 'exclusion';
                const criterionIndex = data.criterion_index;
                
                let status: 'pass' | 'fail' | 'unclear' = 'unclear';
                if (data.result === 'PASS' || data.result === 'MET') {
                  status = 'pass';
                } else if (data.result === 'FAIL' || data.result === 'VIOLATED' || data.result === 'NOT_MET') {
                  status = 'fail';
                }

                const existingCriterionIdx = patient.criteria.findIndex(
                  c => c.index === criterionIndex && c.type === criteriaType
                );

                if (existingCriterionIdx >= 0) {
                  patient.criteria[existingCriterionIdx] = {
                    index: criterionIndex,
                    type: criteriaType,
                    status,
                    criterion: data.criterion,
                    evidence: data.evidence,
                    reasoning: data.reasoning
                  };
                } else {
                  patient.criteria.push({
                    index: criterionIndex,
                    type: criteriaType,
                    status,
                    criterion: data.criterion,
                    evidence: data.evidence,
                    reasoning: data.reasoning
                  });
                }

                newPatients.set(data.patientId, { ...patient });
              }
              
              return newPatients;
            });
            break;

          case 'patient_eligibility':
            setPatients(prev => {
              const newPatients = new Map(prev);
              const patient = newPatients.get(data.patientId);
              
              if (patient) {
                let status: 'eligible' | 'excluded' | 'requires_followup' = 'excluded';
                
                if (data.eligibility === 'ELIGIBLE') {
                  status = 'eligible';
                  setEligibleCount(c => c + 1);
                } else if (data.eligibility === 'REQUIRES_FOLLOW_UP') {
                  status = 'requires_followup';
                } else {
                  setExcludedCount(c => c + 1);
                }

                patient.status = status;
                newPatients.set(data.patientId, { ...patient });
              }
              
              setProcessedPatients(c => c + 1);
              return newPatients;
            });
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
        patients={patients}
        inclusionCount={inclusionCount}
        exclusionCount={exclusionCount}
        onAgent1Complete={handleAgent1Complete}
      />
    </div>
  );
};
