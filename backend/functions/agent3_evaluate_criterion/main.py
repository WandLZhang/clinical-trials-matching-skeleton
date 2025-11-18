import functions_framework
from flask import jsonify
from google import genai
import os
import json
import logging

# --- Initialize Logging ---
logging.basicConfig(level=logging.INFO)

# --- Initialize Google GenAI ---
try:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "wz-clinical-trials-skeleton")
    client = genai.Client(
        vertexai=True,
        project=project_id,
        location="us-central1",
    )
    logging.info(f"Worker: Gemini initialized for project '{project_id}'")
except Exception as e:
    logging.error(f"Worker: Error initializing Gemini: {e}", exc_info=True)

MODEL_NAME = "gemini-2.5-pro"

@functions_framework.http
def evaluate_criterion(request):
    """
    Worker function: Evaluates a single criterion for a single patient.
    Called in parallel by the orchestrator.
    """
    # CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return ('', 204, headers)
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }
    
    try:
        data = request.get_json()
        
        patient_id = data.get('patient_id')
        patient_bundle = data.get('patient_bundle', [])
        criterion = data.get('criterion')
        criterion_type = data.get('criterion_type', 'INCLUSION')
        criterion_index = data.get('criterion_index', 0)
        filter_type = data.get('filter_type', 'SEMANTIC')
        
        if not criterion:
            return (jsonify({'error': 'Missing criterion'}), 400, headers)
        
        # Evaluate based on filter type
        if filter_type == 'FHIR_DIRECT':
            result = apply_fhir_filter(patient_bundle, criterion, criterion_type)
        else:
            result = apply_semantic_filter(patient_bundle, criterion, criterion_type)
        
        # Add metadata
        result['patient_id'] = patient_id
        result['criterion_index'] = criterion_index
        result['criterion_type'] = criterion_type
        
        return (jsonify(result), 200, headers)
        
    except Exception as e:
        logging.exception(f"Worker error: {e}")
        return (jsonify({'error': str(e)}), 500, headers)


def apply_fhir_filter(patient_bundle, criterion, criterion_type):
    """Apply FHIR direct filter using LLM"""
    bundle_text = json.dumps(patient_bundle[:3], indent=2)
    
    prompt = f"""You are a FHIR data expert. Extract and evaluate a specific FHIR field for this criterion.

PATIENT FHIR DATA:
{bundle_text}

CRITERION: "{criterion}"

Extract the relevant FHIR field (e.g., Patient.birthDate for age) and evaluate:

1. If the data is MISSING/not in FHIR → return "MISSING"
2. If the data exists but does NOT meet criterion → return "FAIL"  
3. If the data exists AND meets criterion → return "PASS"

Return ONLY a JSON object:
{{
  "fhir_field": "Patient.birthDate",
  "extracted_value": "1978-03-15",
  "calculated_value": "47 years",
  "result": "PASS" | "FAIL" | "MISSING",
  "evidence": "Quote exact FHIR data (or state 'Data not available')",
  "reasoning": "Brief explanation"
}}"""
    
    try:
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
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
            'result': 'UNCLEAR',
            'evidence': f'Error: {str(e)}',
            'reasoning': 'Failed to evaluate FHIR field',
            'message': 'FHIR filter failed'
        }


def apply_semantic_filter(patient_bundle, criterion, criterion_type):
    """Apply Gemini-based semantic criterion evaluation"""
    bundle_text = json.dumps(patient_bundle[:5], indent=2)
    
    prompt = f"""You are a clinical trial eligibility expert. Evaluate if this patient meets the criterion.

PATIENT FHIR DATA:
{bundle_text}

CRITERION TO EVALUATE:
"{criterion}"

Analyze the patient's FHIR data and determine:

1. If the data is MISSING/not documented → return "MISSING"
2. If the data exists but does NOT meet criterion → return "FAIL"
3. If the data exists AND meets criterion → return "PASS"

IMPORTANT: If there is no information in the FHIR data to confirm the criterion (e.g., no VAS pain score documented, no language/communication field), you MUST return "MISSING" - do not guess or infer.

Return ONLY a JSON object:
{{
  "result": "PASS" | "FAIL" | "MISSING",
  "evidence": "Quote specific FHIR resource data (or state 'Data not available')",
  "reasoning": "Brief explanation"
}}"""
    
    try:
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
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
            'message': 'Semantic evaluation failed'
        }
