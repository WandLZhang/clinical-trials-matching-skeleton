import React from 'react';
import { Handle, Position } from 'reactflow';
import './AgentBox.css';
import './PatientNode.css';
import './PipelineRowNode.css';

interface PipelineRowNodeData {
  trialId: string;
  trialTitle: string;
}

export const PipelineRowNode: React.FC<{ data: PipelineRowNodeData }> = ({ data }) => {
  const patients = Array.from({ length: 10 }).map((_, i) => ({
    id: `P-${100000 + i * 1234}`,
    status: i % 3 === 1 ? 'EXCLUDED' : 'ELIGIBLE'
  }));

  const renderLogsContainer = (logs: string[], json: string) => (
    <div className="replica-grid">
      <div className="replica-column">
        <div className="replica-col-header">Execution Logs</div>
        <div className="replica-scroll-area">
          {logs.map((log, i) => (
            <div key={i} className="log-line">
              <span className="timestamp">[{new Date().toLocaleTimeString()}]</span> {log}
            </div>
          ))}
        </div>
      </div>
      <div className="replica-column">
        <div className="replica-col-header" style={{ color: '#2196F3' }}>JSON Response</div>
        <div className="replica-scroll-area">
          <pre>{json}</pre>
        </div>
      </div>
    </div>
  );

  // SVG Connector Component
  const SvgConnector = ({ type, count, width = 120 }: { type: 'single' | 'fan-out' | 'fan-in', count?: number, width?: number }) => {
    const height = 720; // Match container height
    const centerY = height / 2;
    
    // Path generation logic
    const paths = [];
    if (type === 'single') {
      paths.push(`M0,${centerY} L${width},${centerY}`);
    } else if (type === 'fan-out') {
      // Source: Center Left. Targets: Distributed Right
      const itemHeight = 72; // 60px box + 12px gap
      const startY = (height - (count! * itemHeight - 12)) / 2 + 30; // 30 is half box height
      
      for (let i = 0; i < count!; i++) {
        const targetY = startY + i * itemHeight;
        paths.push(`M0,${centerY} C${width/2},${centerY} ${width/2},${targetY} ${width},${targetY}`);
      }
    } else if (type === 'fan-in') {
      // Source: Distributed Left. Target: Center Right
      const itemHeight = 72;
      const startY = (height - (count! * itemHeight - 12)) / 2 + 30;
      
      for (let i = 0; i < count!; i++) {
        const sourceY = startY + i * itemHeight;
        paths.push(`M0,${sourceY} C${width/2},${sourceY} ${width/2},${centerY} ${width},${centerY}`);
      }
    }

    return (
      <svg width={width} height={height} className="pipeline-svg-connector">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#78909C" />
          </marker>
        </defs>
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="#78909C" strokeWidth="2.5" fill="none" markerEnd="url(#arrowhead)" />
        ))}
      </svg>
    );
  };

  return (
    <div className="pipeline-row-container-full">
      <div className="trial-id-floating">{data.trialId}: {data.trialTitle}</div>
      
      {/* Agent 1 Replica */}
      <div className="agent-container scale-replica">
        <div className="agent-box">
          <div className="agent-header">
            <span className="material-symbols-outlined agent-icon">search</span>
            <h2 className="title-large">Agent 1: Clinical Trial Retrieval</h2>
          </div>
          <div className="agent-content">
            <div className="agent-status status-complete">
              <span className="material-symbols-outlined status-icon">check_circle</span>
              <span className="body-large">Retrieval Complete</span>
            </div>
            <div className="trial-info">
              <p className="body-medium info-label">Trial ID:</p>
              <p className="body-large info-value">{data.trialId}</p>
            </div>
            {renderLogsContainer(
              [
                "✓ Initializing Cloud Function call...",
                "✓ Endpoint: https://api.clinicaltrials.gov/v2/...",
                "✓ Gemini parsing complete",
                "✓ Extracted 12 inclusion criteria",
                "✓ Extracted 8 exclusion criteria",
                "✓ Processing complete"
              ],
              `{
  "nctId": "${data.trialId}",
  "title": "${data.trialTitle}",
  "status": "RECRUITING",
  "phases": ["PHASE3"]
}`
            )}
          </div>
        </div>
      </div>
      
      <SvgConnector type="single" />
      
      {/* Agent 2 Replica */}
      <div className="agent-container scale-replica">
        <div className="agent-box">
          <div className="agent-header">
            <span className="material-symbols-outlined agent-icon">search</span>
            <h2 className="title-large">Agent 2: EHR Matching</h2>
          </div>
          <div className="agent-content">
            <div className="agent-status status-complete">
              <span className="material-symbols-outlined status-icon">check_circle</span>
              <span className="body-large">Matching Complete</span>
            </div>
            {renderLogsContainer(
              [
                "✓ Connected to FHIR Store: fhir-synthea",
                "✓ Searching for matching candidates...",
                "✓ Found 142 potential candidates"
              ],
              `{
  "totalPatients": 12450,
  "processed": 142,
  "matches": [
    { "id": "P-892103", "score": 0.92 }
  ]
}`
            )}
          </div>
        </div>
      </div>
      
      <SvgConnector type="fan-out" count={10} />
      
      {/* Patients Replica */}
      <div className="patients-column-replica">
        {patients.map((p, i) => (
          <div key={i} className="patient-replica-row">
            {/* Patient Box */}
            <div className="patient-box-replica" style={{
              backgroundColor: p.status === 'ELIGIBLE' ? '#E8F5E9' : '#FFEBEE',
              borderColor: p.status === 'ELIGIBLE' ? '#4CAF50' : '#f44336',
            }}>
              <div className="patient-id-text">{p.id}</div>
              <div className="patient-status-icon" style={{ color: p.status === 'ELIGIBLE' ? '#4CAF50' : '#f44336' }}>
                {p.status === 'ELIGIBLE' ? '✓' : '✗'}
              </div>
            </div>
            
            {/* Criteria Strip */}
            <div className="criteria-strip-replica">
               <div className="criteria-row">
                 {[1,2,3,4].map(c => <div key={c} className="mini-criteria-box" style={{ backgroundColor: '#4CAF50', borderColor: '#388E3C' }} />)}
               </div>
               <div className="criteria-row">
                 {[1,2,3].map(c => <div key={c} className="mini-criteria-box" style={{ 
                   backgroundColor: p.status === 'ELIGIBLE' ? '#4CAF50' : (c === 2 ? '#f44336' : '#4CAF50'),
                   borderColor: p.status === 'ELIGIBLE' ? '#388E3C' : (c === 2 ? '#D32F2F' : '#388E3C')
                 }} />)}
               </div>
            </div>
          </div>
        ))}
      </div>

      <SvgConnector type="fan-in" count={10} />
      
      {/* Agent 4 Replica */}
      <div className="agent-container scale-replica">
        <div className="agent-box">
          <div className="agent-header">
            <span className="material-symbols-outlined agent-icon">description</span>
            <h2 className="title-large">Agent 4: Paperwork</h2>
          </div>
          <div className="agent-content">
            <div className="agent-status status-complete">
              <span className="material-symbols-outlined status-icon">check_circle</span>
              <span className="body-large">Paperwork Complete</span>
            </div>
            {renderLogsContainer(
              [
                "✓ Generating consent forms...",
                "✓ Generating eligibility checklists...",
                "✓ Uploading to secure storage...",
                "✓ 3 document bundles created",
                "✓ Secure link generated"
              ],
              `{
  "status": "complete",
  "documents": ["consent.pdf"],
  "url": "https://storage..."
}`
            )}
          </div>
        </div>
      </div>

      <SvgConnector type="fan-out" count={10} width={200} />

      {/* Folder Replica */}
      <div className="folders-column-replica">
         {patients.map((p, i) => (
           <div key={i} className="folder-replica-item" style={{ opacity: p.status === 'ELIGIBLE' ? 1 : 0.3 }}>
             <div className="folder-replica-box">
               <span className="material-symbols-outlined folder-icon">folder</span>
               <span className="folder-text">{p.id}</span>
             </div>
           </div>
         ))}
      </div>

      {/* Hidden handles to satisfy React Flow */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
};
