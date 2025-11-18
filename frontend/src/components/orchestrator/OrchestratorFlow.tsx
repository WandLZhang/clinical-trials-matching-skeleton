import React, { useState, useEffect } from 'react';
import { Agent2Box } from './Agent2Box';
import { PatientGrid } from './PatientGrid';
import './orchestrator.css';

interface CriterionState {
  index: number;
  type: 'inclusion' | 'exclusion';
  status: 'loading' | 'pass' | 'fail' | 'unclear';
  criterion?: string;
  evidence?: string;
  reasoning?: string;
  filter_type?: string;
  field?: string;
}

interface PatientState {
  patientId: string;
  status: 'loading' | 'eligible' | 'excluded' | 'requires_followup';
  criteria: CriterionState[];
  followUpItems?: string[];
  reasonType?: string;
}

interface OrchestratorFlowProps {
  trialData: any;
  onComplete?: () => void;
}

export const OrchestratorFlow: React.FC<OrchestratorFlowProps> = ({
  trialData,
  onComplete
}) => {
  const [patients, setPatients] = useState<Map<string, PatientState>>(new Map());
  const [totalPatients, setTotalPatients] = useState(0);
  const [processedPatients, setProcessedPatients] = useState(0);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [agent2Status, setAgent2Status] = useState<'searching' | 'processing' | 'complete'>('searching');
  const [sseEvents, setSseEvents] = useState<Array<{ timestamp: string; data: any }>>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const inclusionCount = trialData?.inclusion?.length || 5;
  const exclusionCount = trialData?.exclusion?.length || 10;

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_AGENT2_URL;
    
    if (!apiUrl) {
      console.error('Agent 2 API URL not configured');
      return;
    }

    const abortController = new AbortController();

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
            setSearchQuery(data.query || '');
            break;

          case 'searching':
            console.log('Searching FHIR store...');
            break;

          case 'layer1_results':
            setTotalPatients(data.totalPatients || 0);
            setAgent2Status('processing');
            
            // Immediately spawn all patient boxes with pre-populated loading criteria
            if (data.patientIds && Array.isArray(data.patientIds)) {
              setPatients(prev => {
                const newPatients = new Map(prev);
                data.patientIds.forEach((patientId: string) => {
                  // Pre-populate all inclusion and exclusion criteria in loading state
                  const initialCriteria: CriterionState[] = [];
                  
                  // Add all inclusion criteria with actual text
                  if (data.inclusionCriteria && Array.isArray(data.inclusionCriteria)) {
                    data.inclusionCriteria.forEach((criterion: string, idx: number) => {
                      initialCriteria.push({
                        index: idx,
                        type: 'inclusion',
                        status: 'loading',
                        criterion: criterion
                      });
                    });
                  }
                  
                  // Add all exclusion criteria with actual text
                  if (data.exclusionCriteria && Array.isArray(data.exclusionCriteria)) {
                    data.exclusionCriteria.forEach((criterion: string, idx: number) => {
                      initialCriteria.push({
                        index: idx,
                        type: 'exclusion',
                        status: 'loading',
                        criterion: criterion
                      });
                    });
                  }
                  
                  newPatients.set(patientId, {
                    patientId,
                    status: 'loading',
                    criteria: initialCriteria
                  });
                });
                return newPatients;
              });
            }
            break;

          case 'processing_patient':
            // Add new patient to state
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
            // Update criterion for patient
            setPatients(prev => {
              const newPatients = new Map(prev);
              const patient = newPatients.get(data.patientId);
              
              if (patient) {
                const criteriaType = data.criterion_type === 'INCLUSION' ? 'inclusion' : 'exclusion';
                const criterionIndex = data.criterion_index;
                
                // Map result to status
                let status: 'pass' | 'fail' | 'unclear' = 'unclear';
                if (data.result === 'PASS' || data.result === 'MET') {
                  status = 'pass';
                } else if (data.result === 'FAIL' || data.result === 'VIOLATED' || data.result === 'NOT_MET') {
                  status = 'fail';
                }

                // Update or add criterion
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
                    reasoning: data.reasoning,
                    filter_type: data.filter_type,
                    field: data.field
                  };
                } else {
                  patient.criteria.push({
                    index: criterionIndex,
                    type: criteriaType,
                    status,
                    criterion: data.criterion,
                    evidence: data.evidence,
                    reasoning: data.reasoning,
                    filter_type: data.filter_type,
                    field: data.field
                  });
                }

                newPatients.set(data.patientId, { ...patient });
              }
              
              return newPatients;
            });
            break;

          case 'patient_eligibility':
            // Update patient overall status and populate ALL criteria from patient_result.filters
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
                
                // Extract ALL criteria from patient_result.filters array
                const allCriteria: CriterionState[] = [];
                if (data.patient_result?.filters && Array.isArray(data.patient_result.filters)) {
                  data.patient_result.filters.forEach((filter: any) => {
                    const criteriaType = filter.criterion_type === 'INCLUSION' ? 'inclusion' : 'exclusion';
                    const criterionIndex = filter.criterion_index;
                    
                    // Map result to status
                    let criterionStatus: 'pass' | 'fail' | 'unclear' = 'unclear';
                    if (filter.result === 'PASS' || filter.result === 'MET') {
                      criterionStatus = 'pass';
                    } else if (filter.result === 'FAIL' || filter.result === 'VIOLATED' || filter.result === 'NOT_MET') {
                      criterionStatus = 'fail';
                    } else if (filter.result === 'MISSING' || filter.result === 'UNCLEAR') {
                      criterionStatus = 'unclear';
                    }
                    
                    allCriteria.push({
                      index: criterionIndex,
                      type: criteriaType,
                      status: criterionStatus,
                      criterion: filter.criterion,
                      evidence: filter.evidence,
                      reasoning: filter.reasoning,
                      filter_type: filter.filter_type,
                      field: filter.field
                    });
                  });
                }
                
                // Create a completely new patient object for proper React state update
                const updatedPatient: PatientState = {
                  patientId: data.patientId,
                  status: status,
                  criteria: allCriteria,
                  followUpItems: data.patient_result?.follow_up_items || [],
                  reasonType: data.reason_type
                };
                
                newPatients.set(data.patientId, updatedPatient);
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

    // Cleanup
    return () => {
      abortController.abort();
    };
  }, [trialData, onComplete]);

  return (
    <div className="orchestrator-flow">
      <div className="orchestrator-container">
        <div className="orchestrator-left">
          <Agent2Box
            totalPatients={totalPatients}
            processedPatients={processedPatients}
            eligibleCount={eligibleCount}
            excludedCount={excludedCount}
            status={agent2Status}
            sseEvents={sseEvents}
          />
        </div>

        <div className="orchestrator-right">
          <PatientGrid
            patients={patients}
            inclusionCount={inclusionCount}
            exclusionCount={exclusionCount}
          />
        </div>
      </div>
    </div>
  );
};
