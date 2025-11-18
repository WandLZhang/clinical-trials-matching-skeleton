#!/usr/bin/env python3
"""
Local test script for Agent 1 Cloud Function
Tests retrieval and parsing of clinical trial data
"""

import requests
import json
import sys

# Test NCT IDs from DEPLOYMENT_PLAN.md
TEST_NCT_IDS = [
    "NCT06895057",  # Telerehabilitation vs Clinic Core Stabilization
    "NCT06471920",  # Telerehabilitation for Rural Communities
    "NCT06276322",  # All Spine Segments Assessment
]

def test_function_local(nct_id):
    """Test the function running locally on port 8081"""
    url = "http://localhost:8081"
    
    payload = {"nctId": nct_id}
    
    print(f"\n{'='*80}")
    print(f"Testing NCT ID: {nct_id}")
    print(f"{'='*80}")
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.ok:
            data = response.json()
            print(f"\n✓ SUCCESS")
            print(f"\nTitle: {data.get('title', 'N/A')}")
            print(f"Status: {data.get('status', 'N/A')}")
            print(f"Conditions: {', '.join(data.get('conditions', []))}")
            print(f"\nInclusion Criteria ({len(data.get('inclusion', []))}):")
            for i, criterion in enumerate(data.get('inclusion', [])[:3], 1):
                print(f"  {i}. {criterion}")
            if len(data.get('inclusion', [])) > 3:
                print(f"  ... and {len(data.get('inclusion', [])) - 3} more")
            
            print(f"\nExclusion Criteria ({len(data.get('exclusion', []))}):")
            for i, criterion in enumerate(data.get('exclusion', [])[:3], 1):
                print(f"  {i}. {criterion}")
            if len(data.get('exclusion', [])) > 3:
                print(f"  ... and {len(data.get('exclusion', [])) - 3} more")
            
            print(f"\nInterventions: {len(data.get('interventions', []))}")
            for intervention in data.get('interventions', []):
                print(f"  - {intervention.get('type', 'N/A')}: {intervention.get('name', 'N/A')}")
            
            print(f"\nFull Response:")
            print(json.dumps(data, indent=2))
            return True
        else:
            print(f"\n✗ FAILED")
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"\n✗ CONNECTION ERROR")
        print("Make sure the function is running with:")
        print("  functions-framework --target=retrieve_trial_data --debug")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Test specific NCT ID from command line
        nct_id = sys.argv[1]
        test_function_local(nct_id)
    else:
        # Test all default IDs
        print("Testing multiple NCT IDs...")
        results = []
        for nct_id in TEST_NCT_IDS:
            success = test_function_local(nct_id)
            results.append((nct_id, success))
        
        print(f"\n{'='*80}")
        print("SUMMARY")
        print(f"{'='*80}")
        for nct_id, success in results:
            status = "✓ PASS" if success else "✗ FAIL"
            print(f"{status} - {nct_id}")
