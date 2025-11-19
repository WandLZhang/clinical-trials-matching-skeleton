import functions_framework
from flask import jsonify, Response
from google import genai
from google.genai import types
import os
import json
import logging
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
CLINICALTRIALS_API_BASE = "https://clinicaltrials.gov/api/v2"

@functions_framework.http
def retrieve_trial_data(request):
    """
    HTTP Cloud Function for retrieving and parsing clinical trial data.
    Agent 1: Clinical Trial Retrieval
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
        'Access-Control-Allow-Headers': 'Content-Type'
    }

    if request.method != 'POST':
        logging.warning(f"Received non-POST request: {request.method}")
        return (jsonify({'error': 'Method not allowed. Use POST.'}), 405, headers)

    try:
        request_json = request.get_json(silent=True)

        if not request_json:
            logging.warning("Request JSON missing.")
            return (jsonify({'error': 'Missing JSON body'}), 400, headers)

        nct_id = request_json.get('nctId')
        
        if not nct_id:
            return (jsonify({'error': 'Missing nctId field'}), 400, headers)

        def generate():
            """Generator function for streaming response"""
            try:
                # Step 1: Notify start
                yield json.dumps({"status": "info", "message": f"Fetching trial data for {nct_id}..."}) + "\n"

                # Step 2: Fetch from ClinicalTrials.gov API v2
                api_url = f"{CLINICALTRIALS_API_BASE}/studies/{nct_id}?format=json"
                logging.info(f"Fetching from {api_url}")
                
                response = requests.get(api_url, timeout=30)
                
                if not response.ok:
                    error_msg = f"ClinicalTrials.gov API error: {response.status_code}"
                    logging.error(error_msg)
                    yield json.dumps({"status": "error", "message": error_msg}) + "\n"
                    return
                
                data = response.json()
                protocol = data.get('protocolSection', {})
                
                # Step 3: Extract basic information
                identification = protocol.get('identificationModule', {})
                conditions_module = protocol.get('conditionsModule', {})
                status_module = protocol.get('statusModule', {})
                eligibility_module = protocol.get('eligibilityModule', {})
                arms_module = protocol.get('armsInterventionsModule', {})
                contacts_module = protocol.get('contactsLocationsModule', {})
                
                base_trial_data = {
                    'nctId': identification.get('nctId', nct_id),
                    'title': identification.get('briefTitle', ''),
                    'officialTitle': identification.get('officialTitle', ''),
                    'conditions': conditions_module.get('conditions', []),
                    'status': status_module.get('overallStatus', 'UNKNOWN'),
                    'interventions': [
                        {'type': i.get('type', ''), 'name': i.get('name', '')}
                        for i in arms_module.get('interventions', [])
                    ],
                    'contacts': [
                        {
                            'name': c.get('name', ''),
                            'role': c.get('role', ''),
                            'phone': c.get('phone', ''),
                            'email': c.get('email', '')
                        }
                        for c in contacts_module.get('centralContacts', [])
                    ]
                }
                
                # Send base data immediately so frontend has context
                yield json.dumps({"type": "base_data", "data": base_trial_data}) + "\n"
                yield json.dumps({"status": "success", "message": "Trial data retrieved. Starting analysis..."}) + "\n"

                # Step 4: Parse criteria using Gemini 2.5 Pro with streaming
                raw_criteria = eligibility_module.get('eligibilityCriteria', '')
                
                if raw_criteria:
                    prompt = f"""<thinking>
Analyze this clinical trial eligibility criteria step by step:
1. Identify where inclusion criteria section starts and ends
2. Identify where exclusion criteria section starts and ends  
3. Extract each criterion item carefully
4. Clean up formatting while preserving meaning
</thinking>

You are a clinical trial eligibility criteria parser. Parse the following eligibility criteria text into structured inclusion and exclusion criteria lists.

INPUT CRITERIA TEXT:
{raw_criteria}

INSTRUCTIONS:
1. Separate inclusion criteria from exclusion criteria
2. Extract each criterion as a separate item
3. Clean up formatting (remove bullets, numbers, extra whitespace)
4. Keep criteria concise but complete
5. Return ONLY valid JSON in this exact format:

{{
  "inclusion": [
    "criterion 1",
    "criterion 2"
  ],
  "exclusion": [
    "criterion 1",
    "criterion 2"
  ]
}}

Do not include any explanation or markdown formatting. Return ONLY the JSON object."""

                    contents = [types.Content(
                        role="user",
                        parts=[types.Part(text=prompt)]
                    )]
                    
                    config = types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=2048,
                        thinking_config=types.ThinkingConfig(
                            thinking_budget=8192,
                            include_thoughts=True
                        )
                    )
                    
                    chunk_index = 0
                    
                    for chunk in client.models.generate_content_stream(
                        model=MODEL_NAME,
                        contents=contents,
                        config=config
                    ):
                        chunk_index += 1
                        chunk_data = {"chunk_index": chunk_index, "candidates": []}
                        
                        if chunk.candidates:
                            for candidate in chunk.candidates:
                                candidate_data = {}
                                if candidate.content and candidate.content.parts:
                                    candidate_data["content"] = {"parts": []}
                                    for part in candidate.content.parts:
                                        part_data = {}
                                        if hasattr(part, 'text') and part.text:
                                            part_data["text"] = part.text
                                        if hasattr(part, 'thought') and part.thought:
                                            part_data["thought"] = part.thought
                                        if part_data:
                                            candidate_data["content"]["parts"].append(part_data)
                                if candidate_data:
                                    chunk_data["candidates"].append(candidate_data)
                        
                        yield json.dumps(chunk_data, ensure_ascii=False) + "\n"
                    
                    logging.info(f"Streaming complete - total chunks: {chunk_index}")
                else:
                    # No criteria to parse
                    empty_result = {
                        "inclusion": [],
                        "exclusion": []
                    }
                    # Send empty result as if it were a final text chunk
                    yield json.dumps({"type": "final_result", "data": empty_result}) + "\n"
                    
            except Exception as e:
                logging.exception(f"Error during streaming: {str(e)}")
                yield json.dumps({"status": "error", "message": str(e)}) + "\n"

        return Response(generate(), mimetype='text/plain', headers=headers)
        
    except requests.exceptions.Timeout:
        logging.exception("Request timeout")
        return (jsonify({'error': 'Request to ClinicalTrials.gov timed out'}), 504, headers)
    except Exception as e:
        logging.exception(f"Unexpected error: {str(e)}")
        return (jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500, headers)
