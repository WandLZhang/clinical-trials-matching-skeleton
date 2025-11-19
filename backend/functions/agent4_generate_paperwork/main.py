import functions_framework
from flask import jsonify, Response
from google import genai
from google.cloud import storage
import os
import json
import logging
import zipfile
import io
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# --- Initialize Logging ---
logging.basicConfig(level=logging.INFO)

# --- Initialize Clients ---
try:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "wz-clinical-trials-skeleton")
    
    # Initialize GenAI
    client = genai.Client(
        vertexai=True,
        project=project_id,
        location="us-central1",
    )
    
    # Initialize Storage
    storage_client = storage.Client(project=project_id)
    
    logging.info(f"Agent 4 initialized for project '{project_id}'")
except Exception as e:
    logging.error(f"Error initializing Agent 4: {e}", exc_info=True)

MODEL_NAME = "gemini-2.5-pro"
BUCKET_NAME = "wz-clinical-trials-skeleton-generated-docs"

@functions_framework.http
def generate_paperwork(request):
    """
    HTTP Cloud Function for Agent 4: Enrollment Paperwork Generation
    """
    # --- CORS Handling ---
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    }

    if request.method != 'POST':
        return (jsonify({'error': 'Method not allowed. Use POST.'}), 405, headers)

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return (jsonify({'error': 'Missing JSON body'}), 400, headers)

        eligible_patients = request_json.get('eligiblePatients', [])
        trial_info = request_json.get('trialInfo', {})
        
        if not eligible_patients:
            return (jsonify({'error': 'No eligible patients provided'}), 400, headers)

        def generate():
            try:
                yield stream_event('start', f'Starting paperwork generation for {len(eligible_patients)} patients...')
                
                generated_packets = []
                nct_id = trial_info.get('nctId', 'unknown_trial')

                # Check/Create bucket once
                try:
                    bucket = storage_client.bucket(BUCKET_NAME)
                    if not bucket.exists():
                        bucket = storage_client.create_bucket(BUCKET_NAME, location="us-central1")
                except Exception as e:
                    logging.warning(f"Bucket init warning: {e}")
                    bucket = storage_client.bucket(BUCKET_NAME)

                # Use ThreadPoolExecutor for parallel processing
                with ThreadPoolExecutor(max_workers=10) as executor:
                    future_to_patient = {
                        executor.submit(process_patient_paperwork, patient, trial_info, bucket, nct_id): patient 
                        for patient in eligible_patients
                    }
                    
                    completed_count = 0
                    for future in as_completed(future_to_patient):
                        patient = future_to_patient[future]
                        patient_id = patient.get('patientId', 'unknown')
                        completed_count += 1
                        
                        try:
                            result = future.result()
                            
                            yield stream_event('progress', f'Documents generated and uploaded for {patient_id} ({completed_count}/{len(eligible_patients)})', result)
                            
                            if result.get('folderUrl'):
                                generated_packets.append({
                                    'patientId': patient_id,
                                    'folderUrl': result['folderUrl']
                                })
                                
                        except Exception as e:
                            logging.error(f"Processing failed for {patient_id}: {e}")
                            yield stream_event('error', f"Failed to process patient {patient_id}: {e}")

                yield stream_event('complete', 'Paperwork generation complete', {
                    'generatedPackets': generated_packets
                })

            except Exception as e:
                logging.exception(f"Error in Agent 4: {e}")
                yield stream_event('error', str(e))

            except Exception as e:
                logging.exception(f"Error in Agent 4: {e}")
                yield stream_event('error', str(e))

        return Response(generate(), mimetype='text/event-stream', headers=headers)

    except Exception as e:
        logging.exception(f"Unexpected error: {e}")
        return (jsonify({'error': str(e)}), 500, headers)


def stream_event(status, message, data=None):
    event = {'status': status, 'message': message}
    if data:
        event.update(data)
    return f"data: {json.dumps(event)}\n\n"


def process_patient_paperwork(patient, trial_info, bucket, nct_id):
    """Process a single patient: generate docs and upload"""
    patient_id = patient.get('patientId', 'unknown')
    
    # Generate contents (parallelize LLM calls if needed, but keep simple for now)
    cover_letter = generate_cover_letter(patient, trial_info)
    consent_form = generate_consent_form(patient, trial_info)
    checklist = generate_checklist(patient)
    
    # Upload individual files to GCS folder
    base_path = f"{nct_id}/{patient_id}"
    files_to_upload = {
        "Cover_Letter.md": cover_letter,
        "Consent_Form.md": consent_form,
        "Eligibility_Checklist.md": checklist
    }
    
    uploaded_links = {}
    
    for filename, content in files_to_upload.items():
        blob = bucket.blob(f"{base_path}/{filename}")
        
        # Retry upload logic
        upload_blob_with_retry(blob, content)
        
        uploaded_links[filename] = blob.public_url
        
    return {
        'patientId': patient_id,
        'folderUrl': f"https://storage.googleapis.com/{BUCKET_NAME}/{base_path}/",
        'files': uploaded_links
    }

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def upload_blob_with_retry(blob, content):
    blob.upload_from_string(content, content_type='text/markdown')
    try:
        blob.make_public() 
    except Exception as pub_err:
        logging.warning(f"Could not make blob public: {pub_err}")

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def generate_cover_letter(patient, trial_info):
    prompt = f"""You are a clinical research coordinator at UW Medicine. Write a warm, professional personalized cover letter inviting a patient to participate in a clinical trial.

PATIENT ID: {patient.get('patientId')}
TRIAL: {trial_info.get('title')} ({trial_info.get('nctId')})

INSTRUCTIONS:
- Use a professional but empathetic tone.
- Mention that based on their recent medical history (do not be overly specific about private details, just general "health records"), they appear to be a good match.
- Invite them to review the attached consent form.
- Keep it concise (1 page).
- Sign off as "UW Medicine Clinical Trials Team".

Return ONLY the Markdown content of the letter.
"""
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        return response.text
    except Exception as e:
        logging.error(f"Error generating cover letter: {e}")
        # Fallback in case of persistent failure
        return f"# Cover Letter\n\nDear Patient {patient.get('patientId')},\n\nYou are invited to participate in {trial_info.get('title')}."


def generate_consent_form(patient, trial_info):
    # Simple template
    return f"""# INFORMED CONSENT FORM

**Study Title:** {trial_info.get('title')}
**Protocol ID:** {trial_info.get('nctId')}
**Principal Investigator:** UW Medicine Research Team

## Purpose of the Study
You are being asked to participate in a research study. The purpose of this study is to evaluate new treatments for your condition.

## Procedures
If you agree to participate, you will be asked to...

## Risks and Benefits
...

## Confidentiality
Your records will be kept confidential...

## Participant Statement
I understand the above information and agree to participate.

**Patient ID:** {patient.get('patientId')}
**Date:** ____________________
**Signature:** ____________________
"""


def generate_checklist(patient):
    content = f"# Eligibility Checklist\n\n**Patient ID:** {patient.get('patientId')}\n\n"
    
    evaluations = patient.get('evaluations', {})
    
    content += "## Inclusion Criteria\n"
    for key, ev in evaluations.items():
        if ev.get('criterionType') == 'INCLUSION':
            status = "YES" if ev.get('result') == 'PASS' else "NO"
            content += f"- [x] {ev.get('criterionText')} ({status})\n"
            content += f"  - Evidence: {ev.get('evidence')}\n"
            
    content += "\n## Exclusion Criteria (Must be NO)\n"
    for key, ev in evaluations.items():
        if ev.get('criterionType') == 'EXCLUSION':
            status = "NO" if ev.get('result') == 'FAIL' else "YES" # FAIL means didn't exclude (good)
            content += f"- [{'x' if status == 'NO' else ' '}] {ev.get('criterionText')} ({status})\n"
            content += f"  - Evidence: {ev.get('evidence')}\n"
            
    content += "\n**Overall Status:** ELIGIBLE\n"
    content += f"**Verified By:** Agent 2 (AI Matcher)\n"
    content += f"**Date:** {datetime.date.today()}\n"
    
    return content
