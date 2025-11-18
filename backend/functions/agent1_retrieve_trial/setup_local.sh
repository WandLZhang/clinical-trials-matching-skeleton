#!/bin/bash

# Setup script for local testing of Agent 1 Cloud Function

echo "========================================="
echo "Agent 1 Local Testing Setup"
echo "========================================="

# Navigate to function directory
cd "$(dirname "$0")"

# Create virtual environment
echo ""
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "To start local testing:"
echo "  1. Activate venv:    source venv/bin/activate"
echo "  2. Set up GCP auth:  gcloud auth application-default login"
echo "  3. Run function:     functions-framework --target=retrieve_trial_data --debug"
echo "  4. In new terminal:  python test_local.py"
echo ""
echo "Or test specific NCT ID:"
echo "  python test_local.py NCT06895057"
echo ""
