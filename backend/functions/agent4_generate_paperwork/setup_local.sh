#!/bin/bash

# Set environment variables
export GOOGLE_CLOUD_PROJECT="wz-clinical-trials-skeleton"
export MAX_PATIENTS=50

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run with Functions Framework
echo "Starting Agent 4 (Paperwork Generation) on port 8084..."
functions-framework --target=generate_paperwork --port=8084 --debug
