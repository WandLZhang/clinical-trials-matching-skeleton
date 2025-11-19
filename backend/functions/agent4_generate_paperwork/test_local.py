import requests
import json

def test_agent4():
    url = "http://localhost:8084"
    
    # Sample patient based on user provided structure, but marked ELIGIBLE for testing
    patient_data = {
        "patientId": "6b85aa8f-f37c-4514-83cc-3da3fa189500",
        "eligibility": "ELIGIBLE",
        "evaluations": {
          "INCLUSION-0": {
            "criterionText": "People with chronic back pain between the ages of 25-55",
            "criterionType": "INCLUSION",
            "result": "PASS",
            "reasoning": "FHIR filter: 49 years (PASS)",
            "evidence": "\"birthDate\": \"1975-11-28\""
          },
          "INCLUSION-1": {
            "criterionText": "People with back pain for more than 3 months",
            "criterionType": "INCLUSION",
            "result": "PASS",
            "reasoning": "Semantic evaluation: PASS",
            "evidence": "Condition resource..."
          }
        }
    }

    payload = {
        "eligiblePatients": [patient_data],
        "trialInfo": {
            "nctId": "NCT04432597",
            "title": "Low Back Pain Education Study"
        }
    }
    
    print("Sending request to Agent 4...")
    try:
        response = requests.post(url, json=payload, stream=True)
        response.raise_for_status()
        
        print("Response stream started:")
        for line in response.iter_lines():
            if line:
                print(line.decode('utf-8'))
                
    except Exception as e:
        print(f"Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response text: {e.response.text}")

if __name__ == "__main__":
    test_agent4()
