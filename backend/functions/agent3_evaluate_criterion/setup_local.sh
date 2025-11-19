#!/bin/bash

echo "Setting up Agent 3: Evaluate Criterion"
echo "========================================"

# Activate venv
echo "Activating virtual environment..."
source ../../../venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the function
echo ""
echo "Starting function on port 8083..."
echo "Press Ctrl+C to stop"
echo ""

# Set environment variables
export GOOGLE_CLOUD_PROJECT=wz-clinical-trials-skeleton

# Start Functions Framework
functions-framework --target=evaluate_criterion --port=8083 --debug
