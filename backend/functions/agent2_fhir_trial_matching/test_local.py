#!/usr/bin/env python3
"""
Local test script for Agent 2 Cloud Function
Tests FHIR patient matching with streaming status updates
"""

import requests
import json
import sys

# Sample trial data from Agent 1 (NCT06895057)
SAMPLE_TRIAL_DATA = {
    "conditions": [
        "Low Back Pain, Chronic"
    ],
    "contacts": [],
    "criteriaCount": 15,
    "exclusion": [
        "Not accepting to participate in the study,",
        "Having any pathology that causes back pain (e.g. infections, tumors or rheumatoid arthritis)",
        "Having liver, heart, lung, kidney failure or tumor",
        "Having a history of cerebrovascular disease",
        "Having a neurological disease or skeletal muscle degenerative disease",
        "Using assistive devices",
        "Having cognitive disorders",
        "Being pregnant",
        "Having undergone orthopedic surgery in the last two years",
        "Those with scoliosis"
    ],
    "inclusion": [
        "People with chronic back pain between the ages of 25-55",
        "People with back pain for more than 3 months",
        "Ability to read and understand Turkish",
        "Volunteer to participate in the study",
        "Those with pain intensity above 3 on the Visual Analog Scale (VAS)"
    ],
    "interventions": [
        {
            "name": "Exercise",
            "type": "OTHER"
        }
    ],
    "nctId": "NCT06895057",
    "officialTitle": "Comparison of the Effects of Telerehabilitation and Clinic-Applied Core Stabilization Exercises on Pain, Quality of Life and Endurance in Patients With Chronic Low Back Pain",
    "status": "RECRUITING",
    "title": "Comparison of the Effects of Telerehabilitation and Clinic-Applied Core Stabilization Exercises on Pain, Quality of Life and Endurance in Patients With Chronic Low Back Pain"
}


def test_function_local(trial_data=None):
    """Test the function running locally on port 8082 with SSE streaming"""
    url = "http://localhost:8082"
    
    if trial_data is None:
        trial_data = SAMPLE_TRIAL_DATA
    
    payload = {"trialData": trial_data}
    
    print(f"\n{'='*80}")
    print(f"Testing Agent 2: FHIR Trial Matching")
    print(f"{'='*80}")
    print(f"\nTrial: {trial_data.get('nctId', 'N/A')}")
    print(f"Inclusion Criteria: {len(trial_data.get('inclusion', []))}")
    print(f"Exclusion Criteria: {len(trial_data.get('exclusion', []))}")
    print(f"\n{'='*80}\n")
    
    try:
        # Make streaming request
        response = requests.post(
            url, 
            json=payload, 
            stream=True,
            timeout=120
        )
        
        if not response.ok:
            print(f"✗ FAILED - Status Code: {response.status_code}")
            print(f"Error: {response.text}")
            return False
        
        # Process SSE stream
        print("📡 Streaming status updates...\n")
        
        patient_matches = []
        final_summary = None
        query_info = None
        
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                
                # SSE format: "data: {...}"
                if decoded_line.startswith('data: '):
                    try:
                        event_data = json.loads(decoded_line[6:])  # Remove "data: " prefix
                        status = event_data.get('status')
                        message = event_data.get('message', '')
                        
                        if status == 'analyzing':
                            print(f"🤔 {message}")
                        
                        elif status == 'query_constructed':
                            query_info = event_data
                            print(f"🔍 {message}")
                            print(f"   Query: {event_data.get('query', 'N/A')[:100]}...")
                            thoughts = event_data.get('thoughts', [])
                            if thoughts:
                                print(f"   Thinking steps: {len(thoughts)}")
                        
                        elif status == 'searching':
                            print(f"🔎 {message}")
                        
                        elif status == 'search_complete':
                            print(f"✓  {message}")
                            print(f"   Total FHIR resources: {event_data.get('totalResults', 0)}")
                        
                        elif status == 'extracting':
                            print(f"📊 {message}")
                        
                        elif status == 'patients_extracted':
                            print(f"✓  {message}")
                            print(f"   Unique patients identified: {event_data.get('patientCount', 0)}\n")
                        
                        elif status == 'patient_match':
                            patient = event_data.get('patient', {})
                            patient_matches.append(patient)
                            idx = event_data.get('patientIndex', 0)
                            patient_id = patient.get('patientId', 'Unknown')[:12]
                            conditions = patient.get('conditions', [])
                            print(f"   {idx}. Patient {patient_id}... - {len(conditions)} conditions")
                            if conditions:
                                print(f"      • {conditions[0].get('text', 'N/A')}")
                        
                        elif status == 'complete':
                            final_summary = event_data.get('summary', {})
                            print(f"\n✅ {message}")
                            print(f"   Total matches: {final_summary.get('totalMatches', 0)}")
                            print(f"   Displayed: {final_summary.get('displayedMatches', 0)}")
                        
                        elif status == 'error':
                            print(f"\n❌ ERROR: {message}")
                            return False
                    
                    except json.JSONDecodeError as e:
                        print(f"Warning: Failed to parse event: {e}")
                        continue
        
        # Print summary
        print(f"\n{'='*80}")
        print("RESULTS SUMMARY")
        print(f"{'='*80}")
        
        if query_info:
            print(f"\nSearch Query:")
            print(f"  {query_info.get('query', 'N/A')}")
        
        if final_summary:
            print(f"\nMatching Results:")
            print(f"  Total Patients Matched: {final_summary.get('totalMatches', 0)}")
            print(f"  Top Patients Displayed: {final_summary.get('displayedMatches', 0)}")
        
        if patient_matches:
            print(f"\nTop Patient Matches:")
            for i, patient in enumerate(patient_matches[:5], 1):
                patient_id = patient.get('patientId', 'Unknown')
                conditions = patient.get('conditions', [])
                print(f"\n  {i}. Patient ID: {patient_id}")
                print(f"     Resources: {patient.get('resourceCount', 0)}")
                if conditions:
                    print(f"     Conditions:")
                    for cond in conditions[:2]:
                        print(f"       - {cond.get('text', 'N/A')} ({cond.get('recordedDate', 'N/A')[:10]})")
        
        print(f"\n{'='*80}")
        print("✓ TEST PASSED")
        print(f"{'='*80}\n")
        return True
            
    except requests.exceptions.ConnectionError:
        print(f"\n✗ CONNECTION ERROR")
        print("Make sure the function is running with:")
        print("  ./setup_local.sh")
        print("  or")
        print("  functions-framework --target=fhir_trial_matching --debug --port=8082")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Test with sample data
    print("Testing Agent 2 with NCT06895057 data from Agent 1...")
    success = test_function_local()
    
    sys.exit(0 if success else 1)
