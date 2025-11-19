import React, { useState, useEffect, useRef } from 'react';
import { ClinicalTrialsFlowDiagram } from './ClinicalTrialsFlowDiagram';
import './AgentTransitionFlow.css';

// Data structure interfaces
interface PatientEvaluation {
  criterionText: string;
  criterionType: 'INCLUSION' | 'EXCLUSION';
  criterionIndex: number;
  result: 'PASS' | 'FAIL' | 'MISSING';
  reasoning: string;
  evidence: string;
  filterType: 'SEMANTIC' | 'FHIR_DIRECT';
  timestamp: string;
}

interface PatientData {
  patientId: string;
  eligibility?: 'ELIGIBLE' | 'EXCLUDED' | 'REQUIRES_FOLLOW_UP';
  reason?: string;
  evaluations: {
    [criterionId: string]: PatientEvaluation;
  };
  processOrder: number;
  startTime?: string;
  endTime?: string;
}

interface PatientEvaluations {
  [patientId: string]: PatientData;
}

interface FlowData {
  patients: PatientEvaluations;
  totalPatients: number;
  processedCount: number;
}

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

  // New flow data structure
  const [flowData, setFlowData] = useState<FlowData>({
    patients: {},
    totalPatients: 0,
    processedCount: 0
  });
  
  // Temporary storage for criteria text
  const criteriaRef = useRef<{
    [criterionId: string]: { text: string; type: 'INCLUSION' | 'EXCLUSION'; index: number }
  }>({});

  // Use refs to track ongoing requests and prevent duplicates
  const agent2RequestRef = React.useRef<AbortController | null>(null);
  
  // Track patient processing order
  const patientOrderRef = useRef(0);
  
  // Helper function to generate criterion ID
  const getCriterionId = (type: string, index: number) => `${type}-${index}`;


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
    
    // Reset flow data
    setFlowData({
      patients: {},
      totalPatients: 0,
      processedCount: 0
    });
    patientOrderRef.current = 0;
    criteriaRef.current = {};

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
            setAgent2Status('searching');
            break;

          case 'layer1_results':
            setTotalPatients(data.totalPatients || 0);
            setAgent2Status('processing');
            
            // Store criteria in ref
            if (data.inclusionCriteria) {
              data.inclusionCriteria.forEach((criterion: string, index: number) => {
                const criterionId = getCriterionId('INCLUSION', index);
                criteriaRef.current[criterionId] = {
                  text: criterion,
                  type: 'INCLUSION',
                  index
                };
              });
            }
            
            if (data.exclusionCriteria) {
              data.exclusionCriteria.forEach((criterion: string, index: number) => {
                const criterionId = getCriterionId('EXCLUSION', index);
                criteriaRef.current[criterionId] = {
                  text: criterion,
                  type: 'EXCLUSION',
                  index
                };
              });
            }
            
            // Create fully hydrated structure with all patients and all criteria
            const hydratedFlowData: FlowData = {
              patients: {},
              totalPatients: data.totalPatients || 0,
              processedCount: 0
            };
            
            // Pre-populate all patients with all criteria
            if (data.patientIds) {
              data.patientIds.forEach((patientId: string) => {
                hydratedFlowData.patients[patientId] = {
                  patientId,
                  evaluations: {},
                  processOrder: 0, // Will be set when processing starts
                  startTime: undefined,
                  endTime: undefined,
                  eligibility: undefined,
                  reason: undefined
                };
                
                // Add all inclusion criteria with null values
                data.inclusionCriteria?.forEach((text: string, index: number) => {
                  const criterionId = getCriterionId('INCLUSION', index);
                  hydratedFlowData.patients[patientId].evaluations[criterionId] = {
                    criterionText: text,
                    criterionType: 'INCLUSION',
                    criterionIndex: index,
                    result: null as any,
                    reasoning: null as any,
                    evidence: null as any,
                    filterType: null as any,
                    timestamp: null as any
                  };
                });
                
                // Add all exclusion criteria with null values
                data.exclusionCriteria?.forEach((text: string, index: number) => {
                  const criterionId = getCriterionId('EXCLUSION', index);
                  hydratedFlowData.patients[patientId].evaluations[criterionId] = {
                    criterionText: text,
                    criterionType: 'EXCLUSION',
                    criterionIndex: index,
                    result: null as any,
                    reasoning: null as any,
                    evidence: null as any,
                    filterType: null as any,
                    timestamp: null as any
                  };
                });
              });
            }
            
            // Log the master data structure - use JSON.stringify for automatic expansion
            console.log('[Master Data Structure - layer1_results]');
            console.log(JSON.stringify({
              timestamp: new Date().toISOString(),
              flowData: hydratedFlowData,
              rawEvent: data
            }, null, 2));
            
            setFlowData(hydratedFlowData);
            break;

          case 'processing_patient':
            setFlowData(prev => {
              const patientId = data.patientId;
              const updatedFlowData = JSON.parse(JSON.stringify(prev)); // Deep clone
              
              if (updatedFlowData.patients[patientId]) {
                updatedFlowData.patients[patientId].processOrder = ++patientOrderRef.current;
                updatedFlowData.patients[patientId].startTime = timestamp;
              }
              
              // Log the master data structure
              console.log('[Master Data Structure - processing_patient]');
              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                patientId: patientId,
                flowData: updatedFlowData,
                rawEvent: data
              }, null, 2));
              
              return updatedFlowData;
            });
            break;

          case 'filter_result':
            setFlowData(prev => {
              const patientId = data.patient_id;
              const criterionId = getCriterionId(data.criterion_type, data.criterion_index);
              const updatedFlowData = JSON.parse(JSON.stringify(prev)); // Deep clone
              
              // Update the specific criterion evaluation
              if (updatedFlowData.patients[patientId] && 
                  updatedFlowData.patients[patientId].evaluations[criterionId]) {
                updatedFlowData.patients[patientId].evaluations[criterionId] = {
                  ...updatedFlowData.patients[patientId].evaluations[criterionId],
                  result: data.result,
                  reasoning: data.message || data.reasoning || '',
                  evidence: data.evidence || '',
                  filterType: data.filter_type,
                  timestamp
                };
              }
              
              // Log the master data structure
              console.log('[Master Data Structure - filter_result]');
              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                patientId: patientId,
                criterionUpdated: criterionId,
                flowData: updatedFlowData,
                rawEvent: data
              }, null, 2));
              
              return updatedFlowData;
            });
            break;

          case 'patient_eligibility':
            // Update aggregate counts
            if (data.eligibility === 'ELIGIBLE') {
              setEligibleCount(c => c + 1);
            } else if (data.eligibility !== 'REQUIRES_FOLLOW_UP') {
              setExcludedCount(c => c + 1);
            }
            setProcessedPatients(c => c + 1);
            
            setFlowData(prev => {
              const patientId = data.patientId;
              const updatedFlowData = JSON.parse(JSON.stringify(prev)); // Deep clone
              
              if (updatedFlowData.patients[patientId]) {
                updatedFlowData.patients[patientId].eligibility = data.eligibility;
                updatedFlowData.patients[patientId].reason = data.reason;
                updatedFlowData.patients[patientId].endTime = timestamp;
                updatedFlowData.processedCount++;
              }
              
              // Log the master data structure
              console.log('[Master Data Structure - patient_eligibility]');
              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                patientId: patientId,
                eligibility: data.eligibility,
                flowData: updatedFlowData,
                rawEvent: data
              }, null, 2));
              
              return updatedFlowData;
            });
            break;

          case 'complete':
            setAgent2Status('complete');
            
            setFlowData(prev => {
              // Log the final master data structure with summary
              console.log('[Master Data Structure - complete]');
              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                summary: {
                  totalPatients: prev.totalPatients,
                  processedCount: prev.processedCount,
                  eligible: data.summary?.eligiblePatients?.length || 0,
                  excluded: data.summary?.excludedPatients?.length || 0,
                  requiresFollowUp: data.summary?.requiresFollowUpPatients?.length || 0
                },
                flowData: prev,
                rawEvent: data
              }, null, 2));
              
              return prev;
            });
            
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
        flowData={flowData}
        onAgent1Complete={handleAgent1Complete}
      />
    </div>
  );
};
