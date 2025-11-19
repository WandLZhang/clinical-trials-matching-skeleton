import React, { useState } from 'react';
import './PatientSearchTooltip.css';

interface PatientSearchTooltipProps {
  patientId: string;
}

interface SearchResult {
  document: {
    structData: any;
    derivedStructData?: {
      snippets?: Array<{ snippet: string }>;
    };
  };
}

export const PatientSearchTooltip: React.FC<PatientSearchTooltipProps> = ({ patientId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const response = await fetch(import.meta.env.VITE_API_VERTEX_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          query,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="patient-search-tooltip">
      <div className="search-header">
        <strong>Patient History Search</strong>
        <div className="patient-id-label">{patientId}</div>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., pregnant, pain score"
          className="search-input"
          autoFocus
        />
        <button type="submit" disabled={loading} className="search-button">
          {loading ? '...' : '🔍'}
        </button>
      </form>

      <div className="search-results">
        {loading && <div className="loading-indicator">Searching Vertex AI...</div>}
        
        {error && <div className="error-message">{error}</div>}
        
        {!loading && hasSearched && results.length === 0 && !error && (
          <div className="no-results">No documents found matching "{query}"</div>
        )}

        {results.map((result, idx) => {
          const structData = result.document.structData || {};
          const resourceType = structData.resource_type || 'Unknown';
          const snippet = result.document.derivedStructData?.snippets?.[0]?.snippet;
          
          // Extract meaningful content based on resource type
          let displayContent = snippet;
          if (!displayContent || displayContent === "No snippet is available for this page.") {
             // Fallback to structured data display
             if (resourceType === 'Observation' && structData.Observation) {
                 const obs = structData.Observation;
                 displayContent = `${obs.code?.text || 'Observation'}: ${obs.valueQuantity?.value} ${obs.valueQuantity?.unit || ''}`;
             } else if (resourceType === 'Condition' && structData.Condition) {
                 const cond = structData.Condition;
                 displayContent = `${cond.code?.text || 'Condition'} (Onset: ${cond.onsetDateTime})`;
             } else {
                 displayContent = JSON.stringify(structData).substring(0, 100) + "...";
             }
          }

          return (
            <div key={idx} className="search-result-item">
              <div className="result-type">{resourceType}</div>
              <div className="result-content">{displayContent}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
