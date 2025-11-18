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

        # Step 1: Fetch from ClinicalTrials.gov API v2
        logging.info(f"Fetching trial data for {nct_id}...")
        api_url = f"{CLINICALTRIALS_API_BASE}/studies/{nct_id}?format=json"
        
        response = requests.get(api_url, timeout=30)
        
        if not response.ok:
            logging.error(f"ClinicalTrials.gov API error: {response.status_code}")
            return (jsonify({
                'error': f'ClinicalTrials.gov API error: {response.status_code}',
                'details': response.text
            }), 500, headers)
        
        data = response.json()
        protocol = data.get('protocolSection', {})
        
        # Step 2: Extract basic information
        identification = protocol.get('identificationModule', {})
        conditions_module = protocol.get('conditionsModule', {})
        status_module = protocol.get('statusModule', {})
        eligibility_module = protocol.get('eligibilityModule', {})
        arms_module = protocol.get('armsInterventionsModule', {})
        contacts_module = protocol.get('contactsLocationsModule', {})
        
        trial_data = {
            'nctId': identification.get('nctId', nct_id),
            'title': identification.get('briefTitle', ''),
            'officialTitle': identification.get('officialTitle', ''),
            'conditions': conditions_module.get('conditions', []),
            'status': status_module.get('overallStatus', 'UNKNOWN')
        }
        
        # Step 3: Parse criteria using Gemini 2.5 Pro
        raw_criteria = eligibility_module.get('eligibilityCriteria', '')
        
        if raw_criteria:
            logging.info('Parsing eligibility criteria with Gemini...')
            parsed_criteria = parse_criteria_with_gemini(raw_criteria)
            trial_data['inclusion'] = parsed_criteria.get('inclusion', [])
            trial_data['exclusion'] = parsed_criteria.get('exclusion', [])
            trial_data['criteriaCount'] = len(trial_data['inclusion']) + len(trial_data['exclusion'])
        else:
            trial_data['inclusion'] = []
            trial_data['exclusion'] = []
            trial_data['criteriaCount'] = 0
        
        # Step 4: Extract interventions
        interventions = arms_module.get('interventions', [])
        trial_data['interventions'] = [
            {
                'type': i.get('type', ''),
                'name': i.get('name', '')
            }
            for i in interventions
        ]
        
        # Step 5: Extract contacts (if available)
        central_contacts = contacts_module.get('centralContacts', [])
        trial_data['contacts'] = [
            {
                'name': c.get('name', ''),
                'role': c.get('role', ''),
                'phone': c.get('phone', ''),
                'email': c.get('email', '')
            }
            for c in central_contacts
        ]
        
        logging.info(f"Successfully processed {nct_id}")
        return (jsonify(trial_data), 200, headers)
        
    except requests.exceptions.Timeout:
        logging.exception("Request timeout")
        return (jsonify({'error': 'Request to ClinicalTrials.gov timed out'}), 504, headers)
    except requests.exceptions.RequestException as e:
        logging.exception(f"Request error: {str(e)}")
        return (jsonify({'error': f'Request failed: {str(e)}'}), 500, headers)
    except Exception as e:
        logging.exception(f"Unexpected error: {str(e)}")
        return (jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500, headers)


def parse_criteria_with_gemini(raw_criteria):
    """Parse eligibility criteria using Gemini 2.5 Pro with streaming and thinking"""
    
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

    try:
        contents = [types.Content(
            role="user",
            parts=[types.Part(text=prompt)]
        )]
        
        config = types.GenerateContentConfig(
            temperature=0.1,  # Low temperature for consistent parsing
            max_output_tokens=2048,
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_ONLY_HIGH"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_ONLY_HIGH"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_ONLY_HIGH"
                )
            ],
            thinking_config=types.ThinkingConfig(
                thinking_budget=8192,  # Budget for thinking
                include_thoughts=True  # Include thoughts in streaming
            )
        )
        
        # Stream the response for transparency
        response_text = ""
        thoughts = []
        
        logging.info("Streaming Gemini response with thinking...")
        for chunk in client.models.generate_content_stream(
            model=MODEL_NAME,
            contents=contents,
            config=config
        ):
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                for part in chunk.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        response_text += part.text
                        logging.info(f"[TEXT CHUNK] {part.text[:100]}...")
                    if hasattr(part, 'thought') and part.thought:
                        thoughts.append(part.thought)
                        logging.info(f"[THOUGHT] {part.thought}")
        
        logging.info(f"Thinking steps: {len(thoughts)}")
        logging.info(f"Response length: {len(response_text)} chars")
        
        # Extract JSON from potential markdown code blocks
        json_text = response_text.strip()
        if json_text.startswith('```json'):
            json_text = json_text.replace('```json\n', '').replace('```json', '').replace('```', '')
        elif json_text.startswith('```'):
            json_text = json_text.replace('```\n', '').replace('```', '')
        
        parsed = json.loads(json_text.strip())
        
        return {
            'inclusion': parsed.get('inclusion', []),
            'exclusion': parsed.get('exclusion', []),
            'thoughts': thoughts  # Include thoughts for transparency
        }
        
    except json.JSONDecodeError as e:
        logging.error(f"JSON parsing error: {e}")
        logging.error(f"Response text: {response_text}")
        # Fallback: simple text splitting
        result = fallback_parsing(raw_criteria)
        result['thoughts'] = ['Fallback parsing used due to JSON error']
        return result
    except Exception as e:
        logging.exception(f"Gemini parsing error: {str(e)}")
        # Fallback: simple text splitting
        result = fallback_parsing(raw_criteria)
        result['thoughts'] = [f'Fallback parsing used due to error: {str(e)}']
        return result


def fallback_parsing(raw_criteria):
    """Simple fallback parser if Gemini fails"""
    lines = [l.strip() for l in raw_criteria.split('\n') if l.strip()]
    inclusion = []
    exclusion = []
    current_section = None
    
    for line in lines:
        lower = line.lower()
        if 'inclusion criteria' in lower:
            current_section = 'inclusion'
            continue
        elif 'exclusion criteria' in lower:
            current_section = 'exclusion'
            continue
        
        # Check if line starts with bullet or number
        if line.startswith('*') or line.startswith('-') or line.startswith('•'):
            cleaned = line.lstrip('*-•').strip()
            if cleaned and current_section == 'inclusion':
                inclusion.append(cleaned)
            elif cleaned and current_section == 'exclusion':
                exclusion.append(cleaned)
        elif line and line[0].isdigit() and '.' in line[:3]:
            # Numbered list
            cleaned = line.split('.', 1)[1].strip() if '.' in line else line
            if cleaned and current_section == 'inclusion':
                inclusion.append(cleaned)
            elif cleaned and current_section == 'exclusion':
                exclusion.append(cleaned)
    
    return {'inclusion': inclusion, 'exclusion': exclusion}
