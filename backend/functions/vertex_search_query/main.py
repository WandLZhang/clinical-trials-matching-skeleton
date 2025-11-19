import functions_framework
from flask import jsonify
import os
import requests
from google.auth import default
from google.auth.transport.requests import Request
import logging

logging.basicConfig(level=logging.INFO)

LOCATION = "us" # Vertex AI Search location
HEALTHCARE_LOCATION = "us-central1" # Healthcare API location
SEARCH_ENGINE_ID = "clinical-trials-search-app"

@functions_framework.http
def vertex_search_query(request):
    """
    Cloud Function to query Vertex AI Search for a specific patient.
    """
    # CORS Handling
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
        'Content-Type': 'application/json'
    }

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return (jsonify({'error': 'Missing JSON body'}), 400, headers)
        
        patient_id = request_json.get('patientId')
        query = request_json.get('query')
        
        if not patient_id or not query:
            return (jsonify({'error': 'Missing patientId or query'}), 400, headers)
            
        logging.info(f"Searching for '{query}' in patient '{patient_id}'")
        
        # 1. Fetch Patient demographics (always relevant)
        patient_resource = fetch_patient_resource(patient_id)
        
        # 2. Perform Vertex Search
        results = perform_vertex_search(query, patient_id)
        
        # 3. Add Patient resource to results if found
        if patient_resource:
            patient_result = {
                "document": {
                    "structData": {
                        "resource_type": "Patient",
                        "Patient": patient_resource,
                        "patient_id": patient_id
                    },
                    "derivedStructData": {
                        "snippets": [{
                            "snippet": f"Patient Profile: {patient_resource.get('name', [{}])[0].get('given', [''])[0]} {patient_resource.get('name', [{}])[0].get('family', '')}. Born: {patient_resource.get('birthDate', 'N/A')}. Gender: {patient_resource.get('gender', 'N/A')}."
                        }]
                    }
                },
                "id": f"patient-{patient_id}"
            }
            
            if 'results' not in results:
                results['results'] = []
            results['results'].insert(0, patient_result)
            results['totalSize'] = results.get('totalSize', 0) + 1
        
        return (jsonify(results), 200, headers)
        
    except Exception as e:
        logging.exception(f"Unexpected error: {e}")
        return (jsonify({'error': str(e)}), 500, headers)

def fetch_patient_resource(patient_id):
    """Fetch Patient resource directly from FHIR store"""
    try:
        credentials, project_id = default()
        credentials.refresh(Request())
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', project_id)
        
        # Using FHIR store R4
        base_url = f"https://healthcare.googleapis.com/v1/projects/{project_id}/locations/{HEALTHCARE_LOCATION}/datasets/clinical-trials-data/fhirStores/fhir-store-r4/fhir"
        url = f"{base_url}/Patient/{patient_id}"
        
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {credentials.token}"}
        )
        
        if response.ok:
            return response.json()
        return None
    except Exception as e:
        logging.error(f"Error fetching patient: {e}")
        return None

def perform_vertex_search(query, patient_id):
    """Execute search against Vertex AI Search using REST API"""
    try:
        credentials, project_id = default()
        credentials.refresh(Request())
        
        # Use environment variable for project ID if set, otherwise from credentials
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', project_id)
        
        url = (
            f"https://{LOCATION}-discoveryengine.googleapis.com/v1alpha/"
            f"projects/{project_id}/locations/{LOCATION}/"
            f"collections/default_collection/engines/{SEARCH_ENGINE_ID}/"
            f"servingConfigs/default_search:search"
        )
        
        payload = {
            "query": query,
            "filter": f'patient_id: ANY("{patient_id}")',
            "contentSearchSpec": {
                "snippetSpec": {
                    "returnSnippet": True
                }
            },
            "pageSize": 10
        }
        
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {credentials.token}"},
            json=payload
        )
        response.raise_for_status()
        
        return response.json()
        
    except Exception as e:
        logging.exception(f"Vertex search error: {e}")
        raise
