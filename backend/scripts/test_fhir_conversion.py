#!/usr/bin/env python3
"""
Test FHIR conversion with a single patient to debug cleaning issues.
"""

import json
import os
from google.cloud import bigquery

PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT', 'wz-clinical-trials-skeleton')
DATASET_ID = 'fhir_synthea_subset'

def convert_bq_value(value):
    """Recursively convert BigQuery values to JSON-serializable values."""
    if value is None:
        return None
    elif isinstance(value, dict):
        return {k: convert_bq_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [convert_bq_value(item) for item in value]
    else:
        return value

def clean_value(v):
    """Recursively clean a value (dict, list, or primitive)."""
    if v is None:
        return None
    elif isinstance(v, dict):
        return clean_dict(v)
    elif isinstance(v, list):
        return clean_list(v)
    else:
        return v

def clean_list(lst):
    """Recursively clean a list, removing null items."""
    if not isinstance(lst, list):
        return lst
    
    cleaned = []
    for item in lst:
        cleaned_item = clean_value(item)
        if cleaned_item is not None:
            if isinstance(cleaned_item, dict):
                if cleaned_item:
                    cleaned.append(cleaned_item)
            elif isinstance(cleaned_item, list):
                if cleaned_item:
                    cleaned.append(cleaned_item)
            else:
                cleaned.append(cleaned_item)
    
    return cleaned if cleaned else None

def clean_dict(d):
    """Recursively remove null values and unsupported fields from dict."""
    if not isinstance(d, dict):
        return d
    
    cleaned = {}
    for k, v in d.items():
        if v is None:
            continue
        if k == 'geolocation':
            continue
        
        cleaned_v = clean_value(v)
        
        if cleaned_v is not None:
            if isinstance(cleaned_v, dict):
                if cleaned_v:
                    cleaned[k] = cleaned_v
            elif isinstance(cleaned_v, list):
                if cleaned_v:
                    cleaned[k] = cleaned_v
            else:
                cleaned[k] = cleaned_v
    
    return cleaned

def main():
    """Fetch and convert a single patient with detailed output."""
    print("=" * 80)
    print("TESTING SINGLE PATIENT FHIR CONVERSION")
    print("=" * 80)
    
    bq_client = bigquery.Client(project=PROJECT_ID)
    
    # Get one patient
    query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.patient` LIMIT 1"
    print(f"\nQuerying: {query}")
    
    result = bq_client.query(query).result()
    row = next(iter(result))
    
    # Convert to dict
    patient_dict = {k: convert_bq_value(v) for k, v in row.items()}
    
    print("\n" + "=" * 80)
    print("RAW PATIENT DATA FROM BIGQUERY")
    print("=" * 80)
    print(json.dumps(patient_dict, indent=2))
    
    # Now clean field by field
    print("\n" + "=" * 80)
    print("CLEANING EACH FIELD")
    print("=" * 80)
    
    cleaned_patient = {
        "resourceType": "Patient",
        "id": patient_dict.get('id'),
    }
    
    # Test each field
    for field in ['identifier', 'name', 'gender', 'birthDate', 'address', 'telecom', 'maritalStatus', 'communication']:
        if patient_dict.get(field):
            print(f"\n--- Field: {field} ---")
            raw_value = patient_dict[field]
            print(f"Raw value type: {type(raw_value)}")
            print(f"Raw value:")
            print(json.dumps(raw_value, indent=2) if isinstance(raw_value, (list, dict)) else raw_value)
            
            cleaned_value = clean_value(raw_value)
            print(f"\nCleaned value type: {type(cleaned_value)}")
            print(f"Cleaned value:")
            print(json.dumps(cleaned_value, indent=2) if isinstance(cleaned_value, (list, dict)) else cleaned_value)
            
            if cleaned_value:
                cleaned_patient[field] = cleaned_value
            else:
                print("⚠️ Field cleaned to None/empty, not including in output")
    
    print("\n" + "=" * 80)
    print("FINAL CLEANED PATIENT RESOURCE")
    print("=" * 80)
    print(json.dumps(cleaned_patient, indent=2))
    
    # Show NDJSON format
    ndjson = json.dumps(cleaned_patient, separators=(',', ':'))
    print("\n" + "=" * 80)
    print("NDJSON FORMAT (for import)")
    print("=" * 80)
    print(f"Length: {len(ndjson)} bytes")
    print(ndjson)
    
    print("\n" + "=" * 80)
    print("✓ Test complete!")
    print("=" * 80)

if __name__ == '__main__':
    main()
