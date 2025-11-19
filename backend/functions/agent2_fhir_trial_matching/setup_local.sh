#!/bin/bash
# Setup script for running Agent 2 function locally

echo "Setting up Agent 2: FHIR Trial Matching"
echo "========================================"

# Activate venv if it exists
if [ -d "../../../venv" ]; then
    echo "Activating virtual environment..."
    source ../../../venv/bin/activate
fi

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Set environment variables
export GOOGLE_CLOUD_PROJECT="wz-clinical-trials-skeleton"
export MAX_PATIENTS=1

echo ""
echo "Starting function on port 8082..."
echo "Press Ctrl+C to stop"
echo ""

# Run the function
functions-framework --target=fhir_trial_matching --debug --port=8082
