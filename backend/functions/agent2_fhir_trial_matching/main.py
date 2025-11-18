import functions_framework
from flask import jsonify, Response
from google import genai
from google.genai import types
from google.cloud import discoveryengine_v1alpha as discoveryengine
from google.api_core.client_options import ClientOptions
import os
import json
import logging
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

# --- Initialize Logging ---
logging.basicConfig(level=logging.INFO)

# --- Initialize Google GenAI ---
try:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "wz-clinical-trials-skeleton")
    if not project_id:
        logging.warning("GOOGLE_CLOUD_PROJECT environment variable not set.")
    
    # Initialize the client
    client = genai.Client(
        vertexai=True,
        project=project_id,
        location="us-central1",
    )
    logging.info(f"Google GenAI initialized for project '{project_id}'")
except Exception as e:
    logging.error(f"CRITICAL: Error initializing Google GenAI: {e}", exc_info=True)

MODEL_NAME = "gemini-2.5-pro"
LOCATION = "us"
SEARCH_ENGINE_ID = "clinical-trials-search-app"
FHIR_STORE_PATH = "projects/wz-clinical-trials-skeleton/locations/us-central1/datasets/clinical-trials-data/fhirStores/fhir-store-r4"

@functions_framework.http
def fhir_trial_matching(request):
    """
    HTTP Cloud Function for multi-layer funnel patient matching.
    Agent 2: FHIR Trial Matching with transparent filtering
    """
    # --- CORS Handling ---
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    }

    if request.method != 'POST':
        logging.warning(f"Received non-POST request: {request.method}")
        return (jsonify({'error': 'Method not allowed. Use POST.'}), 405, headers)

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return (jsonify({'error': 'Missing JSON body'}), 400, headers)

        trial_data = request_json.get('trialData', {})
        inclusion = trial_data.get('inclusion', [])
        exclusion = trial_data.get('exclusion', [])
        
        if not inclusion:
            return (jsonify({'error': 'Missing inclusion criteria'}), 400, headers)

        # Stream the multi-layer funnel
        def generate():
            try:
                # LAYER 1: Gemini-powered semantic search query
                yield stream_event('layer1_start', 'Constructing semantic search query with Gemini...')
                
                query = construct_semantic_query_with_gemini(inclusion)
                yield stream_event('layer1_complete', f'Query constructed: {query}', {'query': query})
                
                # Execute search
                yield stream_event('searching', f'Searching FHIR store with query: {query}')
                search_results = perform_vertex_search(query)
                
                total_resources = search_results.get('totalSize', 0)
                patient_ids = extract_unique_patients(search_results.get('results', []))
                
                yield stream_event('layer1_results', f'Found {total_resources} FHIR resources, {len(patient_ids)} unique patients', {
                    'totalResources': total_resources,
                    'totalPatients': len(patient_ids),
                    'patientIds': patient_ids
                })
                
                # LAYER 2 & 3: Process ALL patients in parallel!
                eligible_patients = []
                excluded_patients = []
                
                # Process ALL patients (no limit!)
                max_patients = int(os.environ.get('MAX_PATIENTS', len(patient_ids)))
                patient_list = patient_ids[:max_patients]
                
                # Process all patients in parallel using ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=len(patient_list)) as executor:
                    # Submit all patient processing tasks at once
                    future_to_patient = {
                        executor.submit(
                            process_single_patient,
                            idx + 1,
                            patient_id,
                            search_results.get('results', []),
                            inclusion,
                            exclusion,
                            len(patient_list)
                        ): patient_id
                        for idx, patient_id in enumerate(patient_list)
                    }
                    
                    # Stream results as they complete (not in order!)
                    for future in as_completed(future_to_patient):
                        patient_id = future_to_patient[future]
                        try:
                            events = future.result()
                            
                            # Stream all events for this patient (convert dicts to SSE format)
                            for event_dict in events:
                                # Extract message and other fields
                                status = event_dict.pop('status', 'unknown')
                                message = event_dict.pop('message', '')
                                # Remaining fields become data
                                yield stream_event(status, message, event_dict)
                            
                            # Extract patient result from last event
                            patient_result = events[-1]['patient_result']
                            
                            if patient_result['eligibility'] == 'ELIGIBLE':
                                eligible_patients.append(patient_result)
                            else:
                                excluded_patients.append(patient_result)
                                
                        except Exception as e:
                            logging.exception(f"Patient {patient_id} processing failed: {e}")
                            yield stream_event('error', f'Patient {patient_id[:12]}... failed: {str(e)}')
                
                # LAYER 4: Final summary
                yield stream_event('complete', 'Patient matching complete', {
                    'summary': {
                        'totalSearched': len(patient_ids),
                        'totalProcessed': min(len(patient_ids), 50),
                        'eligible': len(eligible_patients),
                        'excluded': len(excluded_patients)
                    },
                    'eligiblePatients': eligible_patients,
                    'excludedPatients': excluded_patients[:10]  # Top 10 excluded
                })
                
            except Exception as e:
                logging.exception(f"Error in streaming: {str(e)}")
                yield stream_event('error', f'Error: {str(e)}')
        
        return Response(generate(), mimetype='text/event-stream', headers=headers)
        
    except Exception as e:
        logging.exception(f"Unexpected error: {str(e)}")
        return (jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500, headers)


def stream_event(status, message, data=None):
    """Helper to format SSE events"""
    event = {'status': status, 'message': message}
    if data:
        event.update(data)
    return f"data: {json.dumps(event)}\n\n"


def construct_semantic_query_with_gemini(inclusion_criteria):
    """Use Gemini to construct optimal semantic search query"""
    
    prompt = f"""You are a medical search expert. Construct a concise semantic search query for a FHIR healthcare database.

INCLUSION CRITERIA:
{chr(10).join(f"- {c}" for c in inclusion_criteria)}

Extract the PRIMARY MEDICAL CONDITION being searched for (e.g., "chronic low back pain", "diabetes type 2").
Ignore demographic criteria (age, gender) and temporal criteria (duration) - focus only on the medical condition.

Return ONLY the search query as plain text (3-5 words maximum), no JSON, no explanation.
Example: "chronic low back pain"
"""
    
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        
        query = response.text.strip().replace('"', '').replace("'", '').lower()
        logging.info(f"Gemini constructed query: {query}")
        return query
        
    except Exception as e:
        logging.exception(f"Gemini query construction failed: {e}")
        # Fallback: extract first medical term
        for criterion in inclusion_criteria:
            words = criterion.lower().split()
            if any(term in words for term in ['pain', 'diabetes', 'cancer', 'disease']):
                return ' '.join(words[:4])
        return "chronic pain"


def process_single_patient(idx, patient_id, search_results, inclusion_criteria, exclusion_criteria, total_patients):
    """Process a single patient through all filters - designed to run in parallel"""
    
    events = []
    
    # Event 1: Processing started (return dict, not formatted SSE)
    events.append({
        'status': 'processing_patient',
        'message': f'Processing patient {idx}/{total_patients}',
        'patientId': patient_id,
        'index': idx,
        'total': total_patients
    })
    
    # Get patient FHIR bundle
    patient_bundle = get_patient_fhir_bundle(patient_id, search_results)
    
    # Apply all filters (criteria evaluated in parallel via workers)
    filter_results = apply_all_filters(patient_id, patient_bundle, inclusion_criteria, exclusion_criteria)
    
    # Stream each filter result
    for filter_result in filter_results:
        events.append({
            'status': 'filter_result',
            'message': filter_result.get('message', f"Evaluated: {filter_result.get('criterion', 'unknown')}"),
            **filter_result
        })
    
    # Determine eligibility (simplified 3-state system)
    inclusion_results = [r for r in filter_results if r['criterion_type'] == 'INCLUSION']
    exclusion_results = [r for r in filter_results if r['criterion_type'] == 'EXCLUSION']
    
    # Check for MISSING data
    has_missing = any(r['result'] == 'MISSING' for r in inclusion_results)
    
    # Check if any inclusion FAILED (patient doesn't meet criterion)
    failed_inclusion = any(r['result'] == 'FAIL' for r in inclusion_results)
    
    # Check if any exclusion was violated (patient meets exclusion criterion)
    violated_exclusion = any(r['result'] == 'FAIL' for r in exclusion_results)
    
    # Check if all inclusions PASSED
    all_passed = all(r['result'] == 'PASS' for r in inclusion_results)
    
    # Simple eligibility logic:
    # 1. Exclusion violation → EXCLUDED
    # 2. Failed inclusion → EXCLUDED
    # 3. All passed → ELIGIBLE
    # 4. Has missing data (but otherwise would pass) → REQUIRES_FOLLOW_UP
    if violated_exclusion:
        eligibility = 'EXCLUDED'
        reason_type = 'exclusion_violated'
    elif failed_inclusion:
        eligibility = 'EXCLUDED'
        reason_type = 'inclusion_failed'
    elif all_passed:
        eligibility = 'ELIGIBLE'
        reason_type = 'fully_eligible'
    else:  # has_missing
        eligibility = 'REQUIRES_FOLLOW_UP'
        reason_type = 'missing_data'
    
    # Identify follow-up items (criteria with MISSING result)
    follow_up_items = [r['criterion'] for r in filter_results if r['result'] == 'MISSING']
    
    patient_result = {
        'patientId': patient_id,
        'eligibility': eligibility,
        'reason_type': reason_type,
        'follow_up_items': follow_up_items if follow_up_items else [],
        'filters': filter_results
    }
    
    # Final event: Patient eligibility (with attached patient_result)
    events.append({
        'status': 'patient_eligibility',
        'message': f'Patient {patient_id[:12]}... is {eligibility}',
        'patientId': patient_id,
        'eligibility': eligibility,
        'reason': filter_results[0].get('reasoning', '') if filter_results else '',
        'patient_result': patient_result  # Attach for extraction
    })
    
    return events


def apply_all_filters(patient_id, patient_bundle, inclusion_criteria, exclusion_criteria):
    """Apply all filtering layers to a patient using parallel worker functions"""
    
    # Worker function URL (local for now, will be Cloud Function URL in production)
    WORKER_URL = os.environ.get('WORKER_URL', 'http://localhost:8083')
    
    # Build all tasks (criterion evaluations)
    all_tasks = []
    
    # Inclusion criteria
    for idx, criterion in enumerate(inclusion_criteria):
        all_tasks.append({
            'patient_id': patient_id,
            'patient_bundle': patient_bundle,
            'criterion': criterion,
            'criterion_type': 'INCLUSION',
            'criterion_index': idx,
            'filter_type': determine_filter_type(criterion)
        })
    
    # Spawn ALL workers in parallel (unlimited parallelism!)
    results = []
    with ThreadPoolExecutor(max_workers=len(all_tasks)) as executor:
        # Submit all HTTP requests at once
        future_to_task = {
            executor.submit(invoke_worker, task): task
            for task in all_tasks
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_task):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logging.exception(f"Worker call failed: {e}")
                task = future_to_task[future]
                results.append({
                    'criterion': task['criterion'],
                    'criterion_index': task['criterion_index'],
                    'criterion_type': task['criterion_type'],
                    'result': 'ERROR',
                    'reasoning': str(e)
                })
    
    # Sort by criterion_index to maintain order
    results.sort(key=lambda x: x.get('criterion_index', 0))
    
    # Check if we should evaluate exclusions (only if no hard failures)
    inclusion_results = [r for r in results if r.get('criterion_type') == 'INCLUSION']
    no_hard_failures = not any(r['result'] == 'FAIL' for r in inclusion_results)
    
    # Evaluate exclusions if no hard failures (allow MISSING/PASS)
    if no_hard_failures:
        exclusion_tasks = []
        for idx, criterion in enumerate(exclusion_criteria):
            exclusion_tasks.append({
                'patient_id': patient_id,
                'patient_bundle': patient_bundle,
                'criterion': criterion,
                'criterion_type': 'EXCLUSION',
                'criterion_index': idx,
                'filter_type': determine_filter_type(criterion)
            })
        
        # Spawn exclusion workers in parallel
        if exclusion_tasks:
            with ThreadPoolExecutor(max_workers=len(exclusion_tasks)) as executor:
                future_to_task = {
                    executor.submit(invoke_worker, task): task
                    for task in exclusion_tasks
                }
                
                for future in as_completed(future_to_task):
                    try:
                        result = future.result()
                        results.append(result)
                    except Exception as e:
                        logging.exception(f"Exclusion worker failed: {e}")
                        task = future_to_task[future]
                        results.append({
                            'criterion': task['criterion'],
                            'criterion_index': task['criterion_index'],
                            'criterion_type': task['criterion_type'],
                            'result': 'ERROR',
                            'reasoning': str(e)
                        })
    
    return results


def invoke_worker(task):
    """Invoke worker function via HTTP to evaluate a single criterion"""
    WORKER_URL = os.environ.get('WORKER_URL', 'http://localhost:8083')
    
    try:
        response = requests.post(
            WORKER_URL,
            json=task,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logging.exception(f"HTTP call to worker failed: {e}")
        raise


def determine_filter_type(criterion):
    """Determine if criterion can be evaluated with FHIR direct lookup or needs semantic reasoning"""
    
    criterion_lower = criterion.lower()
    
    # FHIR direct if it's about age, gender, or simple date comparisons
    if any(term in criterion_lower for term in ['age', 'ages', 'years old', 'gender', 'male', 'female']):
        return 'FHIR_DIRECT'
    
    # Otherwise needs semantic evaluation
    return 'SEMANTIC'


def apply_fhir_filter(patient_id, patient_bundle, criterion, criterion_type):
    """Apply FHIR direct filter using LLM to extract and evaluate FHIR fields"""
    
    # Use Gemini to extract the FHIR field and evaluate
    bundle_text = json.dumps(patient_bundle[:3], indent=2)  # Limit to first 3 resources
    
    prompt = f"""You are a FHIR data expert. Extract and evaluate a specific FHIR field for this criterion.

PATIENT FHIR DATA:
{bundle_text}

CRITERION: "{criterion}"
CRITERION TYPE: {criterion_type}

Extract the relevant FHIR field (e.g., Patient.birthDate for age, Patient.gender for gender) and evaluate if the patient meets this criterion.

For age criteria:
1. Extract birthDate from Patient resource
2. Calculate current age in years
3. Evaluate against the age range in the criterion

Return ONLY a JSON object:
{{
  "fhir_field": "Patient.birthDate" (or other field),
  "extracted_value": "1978-03-15" (or other value),
  "calculated_value": "47 years" (if applicable),
  "result": "PASS" | "FAIL",
  "evidence": "Quote the exact FHIR data",
  "reasoning": "Brief explanation"
}}"""
    
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        
        # Parse JSON from response
        response_text = response.text.strip()
        if '```json' in response_text:
            response_text = response_text.split('```json')[1].split('```')[0].strip()
        elif '```' in response_text:
            response_text = response_text.split('```')[1].split('```')[0].strip()
        
        result_data = json.loads(response_text)
        
        return {
            'criterion': criterion,
            'filter_type': 'FHIR_DIRECT',
            'field': result_data.get('fhir_field', 'unknown'),
            'result': result_data['result'],
            'evidence': result_data['evidence'],
            'reasoning': result_data['reasoning'],
            'message': f"FHIR filter: {result_data.get('calculated_value', result_data.get('extracted_value'))} ({result_data['result']})"
        }
        
    except Exception as e:
        logging.exception(f"FHIR filter error: {e}")
        return {
            'criterion': criterion,
            'filter_type': 'FHIR_DIRECT',
            'field': 'unknown',
            'result': 'UNCLEAR',
            'evidence': f'Error: {str(e)}',
            'reasoning': 'Failed to evaluate FHIR field',
            'message': f"FHIR filter failed for: {criterion[:50]}..."
        }


def apply_semantic_filter(patient_id, patient_bundle, criterion, criterion_type):
    """Apply Gemini-based semantic criterion evaluation"""
    
    # Convert bundle to readable text
    bundle_text = json.dumps(patient_bundle[:5], indent=2)  # Limit to first 5 resources
    
    prompt = f"""You are a clinical trial eligibility expert. Evaluate if this patient meets the criterion.

PATIENT FHIR DATA:
{bundle_text}

CRITERION TO EVALUATE:
"{criterion}"

CRITERION TYPE: {criterion_type}

Analyze the patient's FHIR data and determine if they meet this criterion.
- For INCLUSION: determine if criterion is MET or NOT_MET
- For EXCLUSION: determine if criterion is VIOLATED or NOT_VIOLATED

Return ONLY a JSON object:
{{
  "result": "MET" | "NOT_MET" | "VIOLATED" | "NOT_VIOLATED",
  "evidence": "Quote specific FHIR resource data",
  "reasoning": "Brief explanation"
}}"""
    
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        
        # Parse JSON from response
        response_text = response.text.strip()
        if '```json' in response_text:
            response_text = response_text.split('```json')[1].split('```')[0].strip()
        elif '```' in response_text:
            response_text = response_text.split('```')[1].split('```')[0].strip()
        
        result_data = json.loads(response_text)
        
        return {
            'criterion': criterion,
            'filter_type': 'SEMANTIC',
            'result': result_data['result'],
            'evidence': result_data['evidence'],
            'reasoning': result_data['reasoning'],
            'message': f"Semantic evaluation: {result_data['result']}"
        }
        
    except Exception as e:
        logging.exception(f"Semantic filter error: {e}")
        return {
            'criterion': criterion,
            'filter_type': 'SEMANTIC',
            'result': 'UNCLEAR',
            'evidence': f'Error: {str(e)}',
            'reasoning': 'Failed to evaluate criterion',
            'message': f"Semantic evaluation failed for: {criterion[:50]}..."
        }




def perform_vertex_search(query):
    """Execute search against Vertex AI Search using REST API (avoids gRPC DNS issues)"""
    try:
        from google.auth import default
        from google.auth.transport.requests import Request
        
        # Get credentials
        credentials, project_id = default()
        credentials.refresh(Request())
        
        # Build REST API URL
        url = (
            f"https://{LOCATION}-discoveryengine.googleapis.com/v1alpha/"
            f"projects/{project_id}/locations/{LOCATION}/"
            f"collections/default_collection/engines/{SEARCH_ENGINE_ID}/"
            f"servingConfigs/default_search:search"
        )
        
        # Make REST API call
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {credentials.token}"},
            json={"query": query, "pageSize": 100}
        )
        response.raise_for_status()
        
        data = response.json()
        results = data.get('results', [])
        
        return {
            'results': results,
            'totalSize': len(results)
        }
    except Exception as e:
        logging.exception(f"Vertex search error: {e}")
        return {'results': [], 'totalSize': 0}


def extract_unique_patients(results):
    """Extract unique patient IDs from search results"""
    patient_ids = set()
    
    for result in results:
        struct_data = result.get('document', {}).get('structData', {})
        patient_id = struct_data.get('patient_id')
        
        if patient_id:
            patient_ids.add(patient_id)
        else:
            # Try to extract from resource references
            for resource_type in ['Condition', 'Observation', 'Procedure']:
                resource = struct_data.get(resource_type, {})
                subject = resource.get('subject', {})
                reference = subject.get('reference', '')
                if reference.startswith('Patient/'):
                    patient_ids.add(reference.split('/')[-1])
                    break
    
    return list(patient_ids)


def get_patient_fhir_bundle(patient_id, search_results):
    """Get complete patient FHIR bundle from FHIR store + search results"""
    bundle = []
    
    # 1. Fetch Patient resource from FHIR store (has birthDate, demographics)
    try:
        from google.auth import default
        from google.auth.transport.requests import Request
        import requests as req
        
        credentials, project = default()
        credentials.refresh(Request())
        
        patient_url = f"https://healthcare.googleapis.com/v1/projects/{os.environ.get('GOOGLE_CLOUD_PROJECT', 'wz-clinical-trials-skeleton')}/locations/us-central1/datasets/clinical-trials-data/fhirStores/fhir-store-r4/fhir/Patient/{patient_id}"
        
        response = req.get(
            patient_url,
            headers={"Authorization": f"Bearer {credentials.token}"}
        )
        
        if response.ok:
            patient_resource = response.json()
            bundle.append(patient_resource)
            logging.info(f"Fetched Patient resource for {patient_id}")
        else:
            logging.warning(f"Could not fetch Patient resource: {response.text}")
    except Exception as e:
        logging.exception(f"Error fetching Patient resource: {e}")
    
    # 2. Add resources from search results (Conditions, Observations, etc.)
    for result in search_results:
        struct_data = result.get('document', {}).get('structData', {})
        
        if struct_data.get('patient_id') == patient_id:
            # Extract the FHIR resource
            for resource_type in ['Condition', 'Observation', 'Procedure']:
                if resource_type in struct_data:
                    resource = struct_data[resource_type].copy()
                    resource['resourceType'] = resource_type
                    bundle.append(resource)
        else:
            # Check if resource references this patient
            for resource_type in ['Condition', 'Observation', 'Procedure']:
                resource = struct_data.get(resource_type, {})
                subject = resource.get('subject', {})
                if subject.get('reference') == f'Patient/{patient_id}':
                    resource_copy = resource.copy()
                    resource_copy['resourceType'] = resource_type
                    bundle.append(resource_copy)
    
    return bundle
