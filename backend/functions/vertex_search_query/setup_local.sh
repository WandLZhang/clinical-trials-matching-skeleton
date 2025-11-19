#!/bin/bash
# Setup script for running Vertex Search Query function locally

echo "Setting up Vertex Search Query Function"
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

echo ""
echo "Starting function on port 8084..."
echo "Press Ctrl+C to stop"
echo ""

# Run the function
functions-framework --target=vertex_search_query --debug --port=8084
