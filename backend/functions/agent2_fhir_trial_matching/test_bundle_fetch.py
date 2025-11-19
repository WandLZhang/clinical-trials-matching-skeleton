import os
import logging
from main import get_patient_fhir_bundle

# Setup logging
logging.basicConfig(level=logging.INFO)

# Set env var
os.environ['GOOGLE_CLOUD_PROJECT'] = 'wz-clinical-trials-skeleton'

def test_fetch():
    patient_id = "49dc979d-69b9-459e-80d0-6965b2d4d512"
    print(f"Testing bundle fetch for patient: {patient_id}")
    
    # Mock search results (not needed for new logic, but required by signature)
    search_results = []
    
    bundle = get_patient_fhir_bundle(patient_id, search_results)
    
    print(f"\nBundle contains {len(bundle)} resources:")
    for resource in bundle:
        rtype = resource.get('resourceType', 'Unknown')
        rid = resource.get('id', 'Unknown')
        print(f"- {rtype} ({rid})")
        if rtype == 'Observation':
            print(f"  Value: {resource.get('valueQuantity')}")

if __name__ == "__main__":
    test_fetch()
