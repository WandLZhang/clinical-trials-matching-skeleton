import functions_framework
from flask import jsonify
import os
import requests
from google.auth import default
from google.auth.transport.requests import Request
import logging

logging.basicConfig(level=logging.INFO)

LOCATION = "us"
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
        results = perform_vertex_search(query, patient_id)
        
        return (jsonify(results), 200, headers)
        
    except Exception as e:
        logging.exception(f"Unexpected error: {e}")
        return (jsonify({'error': str(e)}), 500, headers)

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
