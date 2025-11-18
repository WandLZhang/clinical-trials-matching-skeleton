#!/usr/bin/env python3
"""
Create synthetic FHIR patient records that match NCT06895057 criteria.
This helps test Agent 2 (semantic search) and Agent 3 (criterion matching).
"""

import json
import random
from datetime import datetime, timedelta
import requests
from google.auth import default
from google.auth.transport.requests import Request

PROJECT_ID = 'wz-clinical-trials-skeleton'
LOCATION = 'us-central1'
DATASET_ID = 'clinical-trials-data'
FHIR_STORE_ID = 'fhir-store-r4'  # Using R4 FHIR store

# Trial NCT06895057 Criteria:
# Inclusion:
# - Ages 25-55
# - Chronic low back pain >3 months
# - Pain VAS >3
# - Turkish language (we'll use English for testing)
# Exclusion:
# - No prior spine surgery in last 2 years
# - No scoliosis
# - No cognitive disorders
# - No pregnancy
# - No assistive devices

def generate_matching_patient(index):
    """Generate a patient that MATCHES trial criteria."""
    patient_id = f"test-match-{index:04d}"
    
    # Random age between 25-55
    age = random.randint(25, 55)
    birth_date = (datetime.now() - timedelta(days=age*365)).strftime('%Y-%m-%d')
    
    # Random gender
    gender = random.choice(['male', 'female'])
    
    patient = {
        "resourceType": "Patient",
        "id": patient_id,
        "identifier": [
            {
                "system": "http://test-synthetics.uwmedicine.org",
                "value": f"TEST-{patient_id}"
            }
        ],
        "name": [
            {
                "use": "official",
                "family": f"TestPatient{index}",
                "given": ["Synthetic"]
            }
        ],
        "gender": gender,
        "birthDate": birth_date,
        "address": [
            {
                "city": "Seattle",
                "state": "Washington",
                "country": "US",
                "postalCode": "98195"
            }
        ]
    }
    
    return patient

def generate_chronic_pain_condition(patient_id, index):
    """Generate chronic low back pain condition (>3 months)."""
    # Pain started 6-24 months ago
    months_ago = random.randint(6, 24)
    onset_date = (datetime.now() - timedelta(days=months_ago*30)).strftime('%Y-%m-%d')
    
    condition = {
        "resourceType": "Condition",
        "id": f"condition-lbp-{index:04d}",
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "code": {
            "coding": [
                {
                    "system": "http://snomed.info/sct",
                    "code": "279039007",
                    "display": "Low back pain"
                },
                {
                    "system": "http://hl7.org/fhir/sid/icd-10",
                    "code": "M54.5",
                    "display": "Low back pain"
                }
            ],
            "text": "Chronic Low Back Pain"
        },
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": "active"
            }],
            "text": "Active"
        },
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": "confirmed"
            }],
            "text": "Confirmed"
        },
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                        "code": "problem-list-item"
                    }
                ]
            }
        ],
        "onsetDateTime": onset_date
    }
    
    return condition

def generate_pain_observation(patient_id, index):
    """Generate pain score observation (VAS >3)."""
    # Random pain score between 4-8 (inclusive criteria is >3)
    pain_score = random.randint(4, 8)
    
    observation = {
        "resourceType": "Observation",
        "id": f"obs-pain-{index:04d}",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "vital-signs"
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "72514-3",
                    "display": "Pain severity - 0-10 verbal numeric rating [Score] - Reported"
                }
            ],
            "text": "Pain Score (VAS)"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "effectiveDateTime": datetime.now().strftime('%Y-%m-%dT%H:%M:%S+00:00'),
        "valueQuantity": {
            "value": pain_score,
            "unit": "score",
            "system": "http://unitsofmeasure.org",
            "code": "{score}"
        }
    }
    
    return observation

def upload_to_fhir_store(resource):
    """Upload a FHIR resource to the FHIR store using REST API."""
    # Get access token
    credentials, project = default()
    credentials.refresh(Request())
    access_token = credentials.token
    
    resource_type = resource['resourceType']
    
    # FHIR REST API endpoint - POST to the collection to create
    base_url = f"https://healthcare.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/datasets/{DATASET_ID}/fhirStores/{FHIR_STORE_ID}/fhir"
    url = f"{base_url}/{resource_type}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/fhir+json"
    }
    
    # Use POST to create the resource
    response = requests.post(url, headers=headers, json=resource)
    
    if not response.ok:
        print(f"    Error response: {response.text}")
    
    response.raise_for_status()
    
    return response.json()

def main():
    """Generate and upload 10 matching patients."""
    print("=" * 80)
    print("CREATING SYNTHETIC MATCHING PATIENTS FOR NCT06895057")
    print("=" * 80)
    print()
    print("Trial: Low Back Pain Telerehabilitation Study")
    print("Criteria: Ages 25-55, Chronic LBP >3mo, Pain VAS >3")
    print()
    
    num_patients = 10
    
    for i in range(1, num_patients + 1):
        print(f"\n--- Creating Patient {i}/{num_patients} ---")
        
        # Generate patient
        patient = generate_matching_patient(i)
        patient_id = patient['id']
        print(f"Patient ID: {patient_id}")
        print(f"  Age: {2024 - int(patient['birthDate'][:4])}")
        print(f"  Gender: {patient['gender']}")
        
        # Generate condition
        condition = generate_chronic_pain_condition(patient_id, i)
        print(f"  Condition: Chronic Low Back Pain since {condition['onsetDateTime']}")
        
        # Generate observation
        observation = generate_pain_observation(patient_id, i)
        pain_score = observation['valueQuantity']['value']
        print(f"  Pain Score: {pain_score}/10 (VAS)")
        
        # Upload to FHIR store
        try:
            print(f"  Uploading to FHIR store...")
            patient_response = upload_to_fhir_store(patient)
            actual_patient_id = patient_response['id']
            print(f"    Patient created with ID: {actual_patient_id}")
            
            # Update condition and observation with actual patient ID
            condition['subject']['reference'] = f"Patient/{actual_patient_id}"
            observation['subject']['reference'] = f"Patient/{actual_patient_id}"
            
            upload_to_fhir_store(condition)
            upload_to_fhir_store(observation)
            print(f"  ✓ Upload successful")
        except Exception as e:
            print(f"  ✗ Upload failed: {e}")
    
    print("\n" + "=" * 80)
    print(f"✓ Created {num_patients} synthetic matching patients")
    print("=" * 80)
    print()
    print("These patients should:")
    print("  - Match Agent 2 semantic search for LBP trial")
    print("  - Pass Agent 3 criterion-level matching")
    print("  - Be eligible for the trial")

if __name__ == '__main__':
    main()
