#!/usr/bin/env python3
"""
Export BigQuery FHIR data to NDJSON format for import into FHIR store.
This script converts the BigQuery analytics schema to FHIR R4 format.
"""

import json
import os
from datetime import datetime, date
from google.cloud import bigquery
from google.cloud import storage

# Configuration
PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT', 'wz-clinical-trials-skeleton')
DATASET_ID = 'fhir_synthea_subset'
BQ_SOURCE = 'bigquery-public-data.fhir_synthea'
BUCKET_NAME = f'{PROJECT_ID}-fhir-import'
OUTPUT_DIR = 'fhir-r4-ndjson'

# Resource types to export
RESOURCE_TYPES = ['patient', 'condition', 'observation', 'procedure']

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for datetime objects."""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

def convert_bq_value(value):
    """Recursively convert BigQuery values to JSON-serializable values."""
    if value is None:
        return None
    elif isinstance(value, (datetime, date)):
        return value.isoformat()
    elif isinstance(value, dict):
        return {k: convert_bq_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [convert_bq_value(item) for item in value]
    else:
        return value

def create_gcs_bucket():
    """Create GCS bucket if it doesn't exist."""
    storage_client = storage.Client()
    try:
        bucket = storage_client.get_bucket(BUCKET_NAME)
        print(f"Bucket {BUCKET_NAME} already exists")
    except:
        bucket = storage_client.create_bucket(BUCKET_NAME, location='us-central1')
        print(f"Created bucket {BUCKET_NAME}")
    return bucket

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
            # For dicts, only add if not empty
            if isinstance(cleaned_item, dict):
                if cleaned_item:  # non-empty dict
                    cleaned.append(cleaned_item)
            # For lists, only add if not empty
            elif isinstance(cleaned_item, list):
                if cleaned_item:  # non-empty list
                    cleaned.append(cleaned_item)
            # For primitives, add as-is
            else:
                cleaned.append(cleaned_item)
    
    return cleaned if cleaned else None

def clean_dict(d):
    """Recursively remove null values and unsupported fields from dict."""
    if not isinstance(d, dict):
        return d
    
    cleaned = {}
    for k, v in d.items():
        # Skip null values entirely
        if v is None:
            continue
        # Skip geolocation field (not in FHIR spec)
        if k == 'geolocation':
            continue
        
        # Clean the value recursively
        cleaned_v = clean_value(v)
        
        # Only add non-null values
        if cleaned_v is not None:
            # For dicts, only add if non-empty
            if isinstance(cleaned_v, dict):
                if cleaned_v:
                    cleaned[k] = cleaned_v
            # For lists, only add if non-empty
            elif isinstance(cleaned_v, list):
                if cleaned_v:
                    cleaned[k] = cleaned_v
            # For primitives, add as-is
            else:
                cleaned[k] = cleaned_v
    
    return cleaned

def convert_patient_to_fhir(bq_record):
    """Convert BigQuery patient record to FHIR R4 Patient resource."""
    patient = {
        "resourceType": "Patient",
        "id": bq_record.get('id'),
    }
    
    # Add required fields
    if bq_record.get('identifier'):
        patient['identifier'] = bq_record['identifier']
    if bq_record.get('name'):
        patient['name'] = bq_record['name']
    if bq_record.get('gender'):
        patient['gender'] = bq_record['gender']
    if bq_record.get('birthDate'):
        patient['birthDate'] = bq_record['birthDate']
    if bq_record.get('address'):
        patient['address'] = bq_record['address']
    if bq_record.get('telecom'):
        patient['telecom'] = bq_record['telecom']
    if bq_record.get('maritalStatus'):
        patient['maritalStatus'] = bq_record['maritalStatus']
    if bq_record.get('communication'):
        patient['communication'] = bq_record['communication']
    
    # Add extensions
    extensions = []
    if bq_record.get('us_core_race'):
        extensions.append({
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
            "extension": [
                {
                    "url": "ombCategory",
                    "valueCoding": bq_record['us_core_race']['ombCategory']['value']['coding']
                },
                {
                    "url": "text",
                    "valueString": bq_record['us_core_race']['text']['value']['string']
                }
            ]
        })
    if bq_record.get('us_core_ethnicity'):
        extensions.append({
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
            "extension": [
                {
                    "url": "ombCategory",
                    "valueCoding": bq_record['us_core_ethnicity']['ombCategory']['value']['coding']
                },
                {
                    "url": "text",
                    "valueString": bq_record['us_core_ethnicity']['text']['value']['string']
                }
            ]
        })
    if bq_record.get('us_core_birthsex'):
        extensions.append({
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
            "valueCode": bq_record['us_core_birthsex']['value']['code']
        })
    
    if extensions:
        patient['extension'] = extensions
    
    # Add meta
    if bq_record.get('meta'):
        patient['meta'] = bq_record['meta']
    
    # CRITICAL: Clean the entire patient resource to remove nulls, geolocation, etc.
    return clean_value(patient)

def convert_reference(bq_ref):
    """Convert BigQuery reference to FHIR Reference."""
    if not bq_ref:
        return None
    
    # BigQuery analytics schema decomposes references
    # Reconstruct proper FHIR reference
    if bq_ref.get('reference'):
        return {"reference": bq_ref['reference']}
    elif bq_ref.get('patientId'):
        return {"reference": f"Patient/{bq_ref['patientId']}"}
    elif bq_ref.get('groupId'):
        return {"reference": f"Group/{bq_ref['groupId']}"}
    elif bq_ref.get('practitionerId'):
        return {"reference": f"Practitioner/{bq_ref['practitionerId']}"}
    elif bq_ref.get('encounterId'):
        return {"reference": f"Encounter/{bq_ref['encounterId']}"}
    elif bq_ref.get('organizationId'):
        return {"reference": f"Organization/{bq_ref['organizationId']}"}
    return None

def convert_condition_to_fhir(bq_record):
    """Convert BigQuery condition record to FHIR R4 Condition resource."""
    condition = {
        "resourceType": "Condition",
        "id": bq_record.get('id'),
    }
    
    # Convert subject reference
    if bq_record.get('subject'):
        subject_ref = convert_reference(bq_record['subject'])
        if subject_ref:
            condition['subject'] = subject_ref
    
    if bq_record.get('code'):
        condition['code'] = bq_record['code']
    
    # R4 requires CodeableConcept for clinicalStatus and verificationStatus
    if bq_record.get('clinicalStatus'):
        status = bq_record['clinicalStatus']
        status_code = status if isinstance(status, str) else status
        condition['clinicalStatus'] = {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": status_code
            }],
            "text": status_code.capitalize() if status_code else "Active"
        }
    
    if bq_record.get('verificationStatus'):
        status = bq_record['verificationStatus']
        status_code = status if isinstance(status, str) else status
        condition['verificationStatus'] = {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": status_code
            }],
            "text": status_code.capitalize() if status_code else "Confirmed"
        }
    
    if bq_record.get('onsetDateTime'):
        condition['onsetDateTime'] = bq_record['onsetDateTime']
    if bq_record.get('abatementDateTime'):
        condition['abatementDateTime'] = bq_record['abatementDateTime']
    # R4 uses recordedDate instead of assertedDate (STU3)
    if bq_record.get('assertedDate'):
        condition['recordedDate'] = bq_record['assertedDate']
    
    return clean_value(condition)

def convert_observation_to_fhir(bq_record):
    """Convert BigQuery observation record to FHIR R4 Observation resource."""
    observation = {
        "resourceType": "Observation",
        "id": bq_record.get('id'),
        "status": bq_record.get('status', 'final'),
    }
    
    # Convert subject reference
    if bq_record.get('subject'):
        subject_ref = convert_reference(bq_record['subject'])
        if subject_ref:
            observation['subject'] = subject_ref
    
    if bq_record.get('code'):
        observation['code'] = bq_record['code']
    if bq_record.get('effectiveDateTime'):
        observation['effectiveDateTime'] = bq_record['effectiveDateTime']
    if bq_record.get('issued'):
        observation['issued'] = bq_record['issued']
    if bq_record.get('value'):
        # Handle different value types
        if 'quantity' in bq_record['value']:
            observation['valueQuantity'] = bq_record['value']['quantity']
        elif 'codeableConcept' in bq_record['value']:
            observation['valueCodeableConcept'] = bq_record['value']['codeableConcept']
        elif 'string' in bq_record['value']:
            observation['valueString'] = bq_record['value']['string']
    
    return clean_value(observation)

def convert_procedure_to_fhir(bq_record):
    """Convert BigQuery procedure record to FHIR R4 Procedure resource."""
    procedure = {
        "resourceType": "Procedure",
        "id": bq_record.get('id'),
        "status": bq_record.get('status', 'completed'),
    }
    
    # Convert subject reference
    if bq_record.get('subject'):
        subject_ref = convert_reference(bq_record['subject'])
        if subject_ref:
            procedure['subject'] = subject_ref
    
    if bq_record.get('code'):
        procedure['code'] = bq_record['code']
    if bq_record.get('performedDateTime'):
        procedure['performedDateTime'] = bq_record['performedDateTime']
    if bq_record.get('performedPeriod'):
        procedure['performedPeriod'] = bq_record['performedPeriod']
    
    return clean_value(procedure)

def export_resource_type(resource_type, bq_client, storage_client, bucket):
    """Export a specific resource type from BigQuery to GCS as NDJSON."""
    print(f"Exporting {resource_type}...")
    
    # Map resource type to converter function
    converters = {
        'patient': convert_patient_to_fhir,
        'condition': convert_condition_to_fhir,
        'observation': convert_observation_to_fhir,
        'procedure': convert_procedure_to_fhir,
    }
    
    converter = converters.get(resource_type.lower())
    if not converter:
        print(f"No converter for {resource_type}")
        return
    
    # Query our sampled data
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{resource_type}"
    query = f"SELECT * FROM `{table_ref}`"
    
    try:
        query_job = bq_client.query(query)
        results = query_job.result()
        
        # Convert to NDJSON
        ndjson_lines = []
        count = 0
        for row in results:
            try:
                # Convert row to dict and handle datetime objects
                row_dict = {k: convert_bq_value(v) for k, v in row.items()}
                # Convert to FHIR
                fhir_resource = converter(row_dict)
                # Add to NDJSON using custom encoder
                ndjson_lines.append(json.dumps(fhir_resource, separators=(',', ':'), cls=DateTimeEncoder))
                count += 1
            except Exception as e:
                print(f"Error converting record: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        if ndjson_lines:
            # Upload to GCS
            blob_name = f"{OUTPUT_DIR}/{resource_type}.ndjson"
            blob = bucket.blob(blob_name)
            blob.upload_from_string('\n'.join(ndjson_lines), content_type='application/fhir+ndjson')
            print(f"Exported {count} {resource_type} resources to gs://{BUCKET_NAME}/{blob_name}")
        else:
            print(f"No {resource_type} resources to export")
            
    except Exception as e:
        print(f"Error exporting {resource_type}: {e}")

def main():
    """Main export function."""
    print(f"Starting FHIR export from BigQuery to GCS...")
    print(f"Project: {PROJECT_ID}")
    print(f"Bucket: {BUCKET_NAME}")
    
    # Initialize clients
    bq_client = bigquery.Client(project=PROJECT_ID)
    storage_client = storage.Client(project=PROJECT_ID)
    
    # Create bucket
    bucket = create_gcs_bucket()
    
    # Export each resource type
    for resource_type in RESOURCE_TYPES:
        export_resource_type(resource_type, bq_client, storage_client, bucket)
    
    print("\nExport complete!")
    print(f"Files available at: gs://{BUCKET_NAME}/{OUTPUT_DIR}/")

if __name__ == '__main__':
    main()
