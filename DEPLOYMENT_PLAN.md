# Clinical Trials Matching System - Deployment Plan & Architecture

## Project Overview

An end-to-end prototype for University of Washington Medicine to help patients find and enroll in clinical trials through an AI-powered multi-agent system with Material 3 UI.

**Research Foundation**: Implementation based on best practices from:
- Panacea (UIUC/UW): Multi-task clinical trial foundation model
- TrialGPT (NIH/UIUC): Patient-trial matching with LLMs  
- TrialMatchAI (NKI/Bordeaux): Open-source RAG-based matching
- LLM-Match (Mayo Clinic): Fine-tuned models with RAG
- Multiple TREC Clinical Trials benchmarks

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND - Firebase Hosting                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Welcome Screen → Agent 1 Box → Agent 2 Box → Agent 3 Box → Agent 4 Box│
│  (Material 3)     (Trial        (Semantic     (Criterion   (Paperwork  │
│                    Retrieval)    FHIR Search) Matching)    Generation) │
│                       │              │             │            │       │
│                       ↓              ↓             ↓            ↓       │
│                     HTTP           HTTP          HTTP         HTTP     │
│                       │              │             │            │       │
└───────────────────────┼──────────────┼─────────────┼────────────┼───────┘
                        │              │             │            │
                        ↓              ↓             ↓            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND - Cloud Functions                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  retrieveTrialData     semanticPatientSearch    matchCriteriaByPatient │
│         │                     │                          │             │
│         ↓                     ↓                          ↓             │
│  ClinicalTrials.gov      Vertex Search              Gemini 2.5 Pro     │
│  API v2                  Healthcare API             API                │
│         │                     │                          │             │
│         ↓                     ↓                          ↓             │
└─────────┼─────────────────────┼──────────────────────────┼─────────────┘
          │                     │                          │
          ↓                     ↓                          ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ClinicalTrials.gov]   [Vertex Healthcare Store]   [Gemini 2.5 Pro]   │
│   450K+ Trials          FHIR Synthea Data           LLM API             │
│                         (BigQuery Public)                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

KEY:
  →  User flow progression
  ↓  API/Data flow
  [ ]  Data stores/services
```

---

## Agent Architecture Details

### Agent 1: Clinical Trial Retrieval
**Purpose**: Fetch raw trial data from ClinicalTrials.gov

**Input**: NCT ID or condition (e.g., "NCT04432597" or "low back pain")

**Process**:
1. Call ClinicalTrials.gov API v2
2. Extract key sections:
   - Trial title and summary
   - Inclusion criteria (parsed)
   - Exclusion criteria (parsed)
   - Interventions
   - Study design
   - Contact information

**Output**: Structured trial JSON

**Visualization**:
```
┌─────────────────────────────────────┐
│  🔍 Retrieving Clinical Trial...   │
│                                     │
│  NCT04432597                        │
│  "Low Back Pain Education Study"   │
│                                     │
│  ✓ Title extracted                 │
│  ✓ Inclusion criteria parsed       │
│  ✓ Exclusion criteria parsed       │
│  ✓ 8 criteria identified           │
│                                     │
│  [Animated progress bar]            │
└─────────────────────────────────────┘
```

### Agent 2: Semantic Patient Matching via Vertex Search
**Purpose**: Use Vertex AI Search for Healthcare to find matching patients from FHIR records

**Input**: Trial inclusion/exclusion criteria from Agent 1

**Process**:
1. Construct semantic search query from criteria
2. Query Vertex AI Search healthcare data store
3. Discovery Engine performs RAG on FHIR resources:
   - Patient demographics
   - Conditions (ICD-10)
   - Observations (vitals, labs)
   - Medications
   - Procedures
   - Allergies
4. Return ranked patient cohort

**Output**: List of matching FHIR Patient resources with relevance scores

**Visualization**:
```
┌─────────────────────────────────────┐
│  🔬 Semantic FHIR Search...         │
│                                     │
│  Searching 10,247 patient records   │
│                                     │
│  Query: "Adults 18-65 with chronic  │
│  low back pain, no prior surgery"   │
│                                     │
│  ✓ Matching conditions              │
│  ✓ Filtering demographics           │
│  ✓ Excluding procedures             │
│                                     │
│  Found: 234 eligible patients       │
│                                     │
│  [Animated wave progress]           │
└─────────────────────────────────────┘
```

### Agent 3: Criterion-Level Matching
**Purpose**: Use Gemini 2.5 Pro to perform detailed criterion-by-criterion eligibility assessment

**Input**: 
- Patient FHIR bundle (from Agent 2)
- Trial criteria (from Agent 1)

**Process**:
1. For each patient in cohort:
   - Chain-of-Thought reasoning for each criterion
   - Generate explanation for met/not met
   - Cite FHIR resources as evidence
2. Aggregate results per patient

**Output**: Per-patient eligibility matrix with explanations

**Visualization**:
```
┌─────────────────────────────────────┐
│  ⚖️ Criterion-Level Matching...     │
│                                     │
│  Patient: Jane Doe (P-001234)       │
│                                     │
│  Criterion 1: Age 18-65             │
│  ✓ MET - Patient age: 42            │
│                                     │
│  Criterion 2: Chronic pain >6mo     │
│  ✓ MET - Condition since 2023-01   │
│                                     │
│  Criterion 3: No prior surgery      │
│  ✗ NOT MET - L4-L5 fusion 2022     │
│                                     │
│  Overall: EXCLUDED (1/3 failed)     │
│                                     │
│  [Processing 234 patients...]       │
└─────────────────────────────────────┘
```

### Agent 4: Enrollment Paperwork Generation
**Purpose**: Generate enrollment documents for eligible patients

**Input**: Eligible patients list from Agent 3

**Process**:
1. Load consent form templates
2. Populate patient information
3. Generate personalized cover letter
4. Create eligibility checklist

**Output**: PDF/document bundle per patient

**Visualization**:
```
┌─────────────────────────────────────┐
│  📄 Generating Enrollment Docs...   │
│                                     │
│  67 eligible patients identified    │
│                                     │
│  ✓ Consent forms (67)               │
│  ✓ Eligibility checklists (67)      │
│  ✓ Cover letters (67)               │
│  ✓ Contact information sheets (67)  │
│                                     │
│  Ready for coordinator review       │
│                                     │
│  [Document icons animating]         │
└─────────────────────────────────────┘
```

---

## UX Flow - Detailed Demo Script

### Screen 1: Welcome (0:00 - 0:03)
**Visual**:
- Material 3 gradient background (light blue to soft purple)
- Animated "UW Medicine" logo fade-in
- Subtle pulse animation on main card
- Clean typography: "Clinical Trial Matching Platform"

**Elements**:
```tsx
<Box sx={{
  background: 'linear-gradient(135deg, #E3F2FD 0%, #F3E5F5 100%)',
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
}}>
  <Card elevation={3} sx={{ 
    maxWidth: 500, 
    p: 4,
    animation: 'pulse 2s ease-in-out infinite'
  }}>
    <CardContent>
      <Typography variant="h3" color="primary" gutterBottom>
        Clinical Trial Matching
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        AI-powered patient recruitment for UW Medicine
      </Typography>
      <Button 
        variant="contained" 
        size="large"
        onClick={handleGetStarted}
        sx={{ mt: 2 }}
      >
        Get Started
      </Button>
    </CardContent>
  </Card>
</Box>
```

**User Action**: Click "Get Started"

**Animation**: 
- Welcome card fades out (0.5s)
- Screen transitions to white canvas

---

### Screen 2: Agent 1 - Trial Retrieval (0:03 - 0:08)

**Animation In**: 
- Agent 1 box slides in from right (0.4s Material 3 standard easing)
- Centers on screen

**Visual**:
```
┌──────────────────────────────────────────┐
│  Agent 1: Clinical Trial Retrieval       │
├──────────────────────────────────────────┤
│                                          │
│  🔍 Querying ClinicalTrials.gov...       │
│                                          │
│  Trial ID: NCT04432597                   │
│                                          │
│  ━━━━━━━━━━━━━━━━━━━━ 100%             │
│                                          │
│  ✓ Trial metadata retrieved              │
│  ✓ 8 inclusion criteria parsed           │
│  ✓ 5 exclusion criteria parsed           │
│                                          │
└──────────────────────────────────────────┘
```

**Backend Call**:
```javascript
// Cloud Function
exports.retrieveTrialData = async (req, res) => {
  const { nctId } = req.body;
  
  const response = await fetch(
    `https://clinicaltrials.gov/api/v2/studies/${nctId}`
  );
  
  const trial = await response.json();
  
  // Extract and structure
  const structured = {
    nctId: trial.protocolSection.identificationModule.nctId,
    title: trial.protocolSection.identificationModule.briefTitle,
    inclusion: parseCriteria(trial, 'inclusion'),
    exclusion: parseCriteria(trial, 'exclusion'),
    // ... more fields
  };
  
  res.json(structured);
};
```

**Data Displayed**:
- Trial title appears (typewriter effect)
- Criteria count updates in real-time
- Progress bar fills (simulated 3-5 seconds)

**User Sees**: Real-time extraction happening

---

### Screen 3: Agent 2 - Semantic FHIR Search (0:08 - 0:15)

**Animation**:
- Agent 1 box slides left (0.4s)
- Agent 2 box slides from right, centers (0.4s)
- Left arrow button appears (transparent, for back navigation)

**Visual**:
```
┌──────────────────────────────────────────┐
│  Agent 2: Semantic Patient Search        │
├──────────────────────────────────────────┤
│                                          │
│  🔬 Searching FHIR database...           │
│                                          │
│  Data: bigquery-public-data.fhir_synthea│
│  Records: 10,247 patients               │
│                                          │
│  Query:                                 │
│  "Adults 18-65 with chronic low back    │
│   pain, no contraindications"           │
│                                          │
│  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿ [Wavy animation] │
│                                          │
│  Results: 234 matching patients         │
│                                          │
│  Top matches:                           │
│  • Patient P-001234 (Score: 0.94)      │
│  • Patient P-005678 (Score: 0.91)      │
│  • Patient P-009012 (Score: 0.89)      │
│                                          │
└──────────────────────────────────────────┘
```

**Backend Call**:
```javascript
// Cloud Function
exports.semanticPatientSearch = async (req, res) => {
  const { trialCriteria } = req.body;
  
  // Construct query from criteria
  const query = constructSemanticQuery(trialCriteria);
  
  // Call Vertex AI Search for Healthcare
  const client = new SearchServiceClient();
  const searchResponse = await client.search({
    servingConfig: `projects/${PROJECT_ID}/locations/us/` +
      `dataStores/fhir-synthea-store/servingConfigs/default_search`,
    query: query,
    pageSize: 100,
    queryExpansionSpec: { condition: 'AUTO' },
    spellCorrectionSpec: { mode: 'AUTO' }
  });
  
  // Extract patient IDs and scores
  const patients = searchResponse.results.map(result => ({
    patientId: result.document.id,
    score: result.relevanceScore,
    fhirBundle: JSON.parse(result.document.jsonData)
  }));
  
  res.json({ patients, count: patients.length });
};

function constructSemanticQuery(criteria) {
  return `
    Find patients matching these criteria:
    
    Inclusion:
    ${criteria.inclusion.join('\n')}
    
    Exclusion (must NOT match):
    ${criteria.exclusion.join('\n')}
  `;
}
```

**Animation Details**:
- Wavy progress indicator (Material 3 style)
- Patient count animates from 0 → 234
- Top 3 results fade in sequentially
- Score bars animate to fill width

---

### Screen 4: Agent 3 - Criterion Matching (0:15 - 0:25)

**Animation**:
- Agent 2 slides left
- Agent 3 slides from right, centers
- Left arrow still visible

**Visual**:
```
┌──────────────────────────────────────────┐
│  Agent 3: Criterion-Level Matching       │
├──────────────────────────────────────────┤
│                                          │
│  ⚖️ Analyzing 234 patients...            │
│                                          │
│  Current: Patient P-001234               │
│  Progress: 67/234 (29%)                 │
│                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━ 29%          │
│                                          │
│  Criterion Analysis:                    │
│  ┌────────────────────────────────────┐ │
│  │ 1. Age 18-65        ✓ MET         │ │
│  │    Evidence: DOB 1982-03-15       │ │
│  │                                    │ │
│  │ 2. Chronic pain >6mo ✓ MET        │ │
│  │    Evidence: Condition since      │ │
│  │    2023-01-10 (22 months)         │ │
│  │                                    │ │
│  │ 3. No prior surgery  ✗ NOT MET    │ │
│  │    Evidence: L4-L5 fusion         │ │
│  │    procedure 2022-08-15           │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Status: EXCLUDED (1 criterion failed)  │
│                                          │
│  Summary:                               │
│  • 67 patients ELIGIBLE                 │
│  • 167 patients EXCLUDED                │
│                                          │
└──────────────────────────────────────────┘
```

**Backend Call**:
```javascript
// Cloud Function
exports.matchCriteriaByPatient = async (req, res) => {
  const { patients, trialCriteria } = req.body;
  
  const results = [];
  
  for (const patient of patients) {
    // Call Gemini 2.5 Pro for each patient
    const prompt = `
You are a clinical trial eligibility expert. Analyze this patient against the trial criteria.

Patient FHIR Data:
${JSON.stringify(patient.fhirBundle, null, 2)}

Trial Criteria:
Inclusion:
${trialCriteria.inclusion.map((c, i) => `${i+1}. ${c}`).join('\n')}

Exclusion:
${trialCriteria.exclusion.map((c, i) => `${i+1}. ${c}`).join('\n')}

For each criterion, provide:
1. Status: MET, NOT MET, or UNCLEAR
2. Evidence: Quote specific FHIR resource data
3. Reasoning: Brief explanation

Then provide overall eligibility: ELIGIBLE or EXCLUDED

Use Chain-of-Thought reasoning.
`;

    const response = await vertexAI.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    });
    
    const analysis = parseGeminiResponse(response.text);
    
    results.push({
      patientId: patient.patientId,
      criteriaAnalysis: analysis.criteria,
      overallStatus: analysis.overall,
      reasoning: analysis.reasoning
    });
  }
  
  const eligible = results.filter(r => r.overallStatus === 'ELIGIBLE');
  const excluded = results.filter(r => r.overallStatus === 'EXCLUDED');
  
  res.json({
    results,
    summary: {
      eligible: eligible.length,
      excluded: excluded.length,
      total: results.length
    }
  });
};
```

**Animation Details**:
- Progress bar updates in real-time
- Current patient ID changes rapidly
- Criterion checkmarks/X marks appear sequentially
- Summary counts increment
- Smooth scroll through patient list

---

### Screen 5: Agent 4 - Paperwork Generation (0:25 - 0:30)

**Animation**:
- Agent 3 slides left
- Agent 4 slides from right, centers

**Visual**:
```
┌──────────────────────────────────────────┐
│  Agent 4: Enrollment Paperwork           │
├──────────────────────────────────────────┤
│                                          │
│  📄 Generating documents for 67 patients │
│                                          │
│  Progress: 67/67 (100%)                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━ 100%          │
│                                          │
│  Documents Created:                     │
│  ┌────────────────────────────────────┐ │
│  │ ✓ Consent forms (67)               │ │
│  │ ✓ Eligibility checklists (67)      │ │
│  │ ✓ Cover letters (67)               │ │
│  │ ✓ Contact sheets (67)              │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Preview: Patient P-001234              │
│  ┌────────────────────────────────────┐ │
│  │ INFORMED CONSENT FORM              │ │
│  │                                    │ │
│  │ Study: NCT04432597                │ │
│  │ Patient: [REDACTED]                │ │
│  │                                    │ │
│  │ You are being invited to          │ │
│  │ participate in a research study...│ │
│  └────────────────────────────────────┘ │
│                                          │
│  [Download All] [View Details]          │
│                                          │
└──────────────────────────────────────────┘
```

**Backend Call**:
```javascript
// Cloud Function
exports.generatePaperwork = async (req, res) => {
  const { eligiblePatients, trialInfo } = req.body;
  
  const documents = [];
  
  for (const patient of eligiblePatients) {
    // Generate consent form
    const consent = await generateConsentForm({
      patient,
      trial: trialInfo,
      template: 'consent_form_uwmedicine.docx'
    });
    
    // Generate eligibility checklist
    const checklist = await generateChecklist({
      patient,
      criteriaResults: patient.criteriaAnalysis
    });
    
    // Generate cover letter
    const coverLetter = await generateCoverLetter({
      patient,
      trial: trialInfo,
      coordinator: 'UW Medicine Clinical Trials Office'
    });
    
    documents.push({
      patientId: patient.patientId,
      consent,
      checklist,
      coverLetter
    });
  }
  
  // Create ZIP archive
  const zipBuffer = await createZipArchive(documents);
  
  res.json({
    documentCount: documents.length,
    downloadUrl: await uploadToStorage(zipBuffer)
  });
};
```

**Animation**:
- Document icons fade in
- Progress bar fills
- PDF preview slides up
- Checkmarks appear sequentially

---

### Screen 6: Final View - Programmatic Scale (0:30 - 0:35)

**Animation**:
- All 4 agent boxes visible on screen
- Camera "zooms out" (scale animation)
- Boxes shrink and multiply
- Grid of mini-boxes appears showing the concept

**Visual**:
```
┌─────────────────────────────────────────────────┐
│  Programmatic Clinical Trial Matching           │
├─────────────────────────────────────────────────┤
│                                                 │
│  This workflow repeats for every trial:         │
│                                                 │
│  [Box1] [Box2] [Box3] [Box4]  Trial #1         │
│  [Box1] [Box2] [Box3] [Box4]  Trial #2         │
│  [Box1] [Box2] [Box3] [Box4]  Trial #3         │
│  [Box1] [Box2] [Box3] [Box4]  Trial #4         │
│  ...                                            │
│  [Box1] [Box2] [Box3] [Box4]  Trial #N         │
│                                                 │
│  Scaling Capabilities:                          │
│  • 450,000+ trials in ClinicalTrials.gov        │
│  • Automated patient matching per trial         │
│  • Continuous enrollment as new data arrives    │
│                                                 │
│  Representative Examples:                       │
│  ┌──────────────────────────────────┐          │
│  │ Oncology Trials:      1,234      │          │
│  │ Cardiology Trials:    892        │          │
│  │ Neurology Trials:     654        │          │
│  │ Diabetes Trials:      431        │          │
│  └──────────────────────────────────┘          │
│                                                 │
│  [Start New Match] [Export Results]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Animation Details**:
- Smooth scale transformation (Material 3 emphasized easing)
- Grid layout with stagger animation
- Number counters increment
- Pulse effect on representative boxes

---

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material UI v5 (Material 3 components)
- **Styling**: Material 3 Design System
  - Color: Dynamic color schemes
  - Typography: Roboto/Google Sans
  - Motion: Material 3 easing curves
- **Animation**: Framer Motion for transitions
- **Build**: Vite
- **Hosting**: Firebase Hosting

### Backend
- **Runtime**: Cloud Functions (Node.js 20)
- **APIs**:
  - ClinicalTrials.gov API v2 (REST)
  - Vertex AI Search API (Healthcare)
  - Vertex AI Gemini API
- **Authentication**: Firebase Auth + Cloud IAM

### Data & AI
- **FHIR Data**: BigQuery public dataset `bigquery-public-data.fhir_synthea`
- **Search**: Vertex AI Search for Healthcare (Discovery Engine)
- **LLM**: Vertex AI Gemini 2.5 Pro
- **Prompting**: Chain-of-Thought reasoning templates

---

## Deployment Steps

### Prerequisites

1. **GCP Project Setup**:
```bash
# Create project
gcloud projects create uw-clinical-trials-demo --name="UW Clinical Trials"

# Set project
gcloud config set project uw-clinical-trials-demo

# Enable required APIs
gcloud services enable \
  cloudfunctions.googleapis.com \
  firebase.googleapis.com \
  discoveryengine.googleapis.com \
  aiplatform.googleapis.com \
  healthcare.googleapis.com
```

2. **Install Dependencies**:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

---

### Step 1: Configure Vertex AI Search for Healthcare

Project: `wz-clinical-trials-skeleton`

#### Data Preparation Scripts

Before creating the Vertex AI Search data store, we prepared a curated FHIR R4 dataset:

**Created Files**:
1. `backend/scripts/export_bq_to_fhir.py` - Export BigQuery → FHIR R4 NDJSON
   - Converts BigQuery analytics schema to proper FHIR R4
   - Handles STU3→R4 mapping (`assertedDate`→`recordedDate`)
   - Adds required `text` fields to CodeableConcept statuses
   - Removes null values and unsupported fields
   - Exports 118,314 resources to GCS

2. `backend/scripts/create_matching_patients.py` - Generate test patients
   - Creates 10 synthetic patients matching trial NCT06895057
   - R4-formatted with proper CodeableConcepts
   - Ages 25-55, chronic low back pain, pain scores 4-8/10
   - Uploads directly to R4 FHIR store

3. `backend/scripts/test_fhir_conversion.py` - Validation utilities

**Cloud Resources Created**:
- **BigQuery Dataset**: `fhir_synthea_subset` (sampled from public data)
- **Healthcare API Dataset**: `clinical-trials-data` (us-central1)
  - **FHIR Store (STU3)**: `fhir-store` - 118,344 resources
  - **FHIR Store (R4)**: `fhir-store-r4` - 118,344 resources (includes 10 synthetic patients)
- **GCS Bucket**: `wz-clinical-trials-skeleton-fhir-import`
  - Contains FHIR R4 NDJSON exports (patient, condition, observation, procedure)

Configure:
   - **Data source**: FHIR store from Cloud Healthcare API
   - **FHIR store**: `projects/wz-clinical-trials-skeleton/locations/us-central1/datasets/clinical-trials-data/fhirStores/fhir-store-r4`
   - **Synchronization**: "One time" (batch import)
   - **Schema**: "Google predefined schema"
   - **Data store ID**: `clinical-trials-fhir-store`
   - **Display name**: "Clinical Trials FHIR Patient Data"

#### API

```bash
# 1. Create data store
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: uw-clinical-trials-demo" \
  "https://us-discoveryengine.googleapis.com/v1/projects/uw-clinical-trials-demo/locations/us/collections/default_collection/dataStores?dataStoreId=fhir-synthea-store" \
  -d '{
    "displayName": "FHIR Synthea Patient Data",
    "industryVertical": "HEALTHCARE_FHIR",
    "solutionTypes": ["SOLUTION_TYPE_SEARCH"],
    "searchTier": "STANDARD",
    "searchAddOns": ["LLM"],
    "healthcareFhirConfig": {
      "enableConfigurableSchema": false
    }
  }'

# 2. Import FHIR data (Note: May need to create FHIR store first from BigQuery)
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: uw-clinical-trials-demo" \
  "https://us-discoveryengine.googleapis.com/v1/projects/uw-clinical-trials-demo/locations/us/dataStores/fhir-synthea-store/branches/0/documents:import" \
  -d '{
    "reconciliation_mode": "FULL",
    "fhir_store_source": {
      "fhir_store": "projects/bigquery-public-data/locations/us/datasets/fhir_synthea/fhirStores/synthea"
    }
  }'

# 3. Verify import status
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://us-discoveryengine.googleapis.com/v1/projects/uw-clinical-trials-demo/locations/us/collections/default_collection/dataStores/fhir-synthea-store"

# 4. Create healthcare search app
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: wz-clinical-trials-skeleton" \
  "https://us-discoveryengine.googleapis.com/v1/projects/wz-clinical-trials-skeleton/locations/us/collections/default_collection/engines?engineId=clinical-trials-search-app" \
  -d '{
    "displayName": "Clinical Trials Search App",
    "industryVertical": "HEALTHCARE_FHIR",
    "solutionType": "SOLUTION_TYPE_SEARCH",
    "searchEngineConfig": {
      "searchTier": "SEARCH_TIER_STANDARD",
      "searchAddOns": ["SEARCH_ADD_ON_LLM"]
    },
    "dataStoreIds": ["clinical-trials-fhir-store"]
  }'
```

**Import Results**: 118,344 resources indexed (12m 49s, 100% success rate)

**Search App Endpoint**:
```
POST https://us-discoveryengine.googleapis.com/v1alpha/projects/wz-clinical-trials-skeleton/locations/us/collections/default_collection/engines/clinical-trials-search-app/servingConfigs/default_search:search
```

**Test Search**:
```bash
# Test query for chronic pain patients
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://us-discoveryengine.googleapis.com/v1alpha/projects/wz-clinical-trials-skeleton/locations/us/collections/default_collection/engines/clinical-trials-search-app/servingConfigs/default_search:search" \
  -d '{
    "query": "low back pain chronic",
    "pageSize": 10,
    "contentSearchSpec": {
      "snippetSpec": {
        "returnSnippet": true
      }
    }
  }'

# Returns: 510 matching Condition resources with patient references
```

**IAM Permissions Required**:
```bash
# Grant Vertex AI Search permission to export from FHIR store
gcloud healthcare fhir-stores add-iam-policy-binding fhir-store-r4 \
  --dataset=clinical-trials-data \
  --location=us-central1 \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-discoveryengine.iam.gserviceaccount.com" \
  --role="roles/healthcare.fhirStoreAdmin"

# Grant Healthcare API permission to write to GCS bucket
gsutil iam ch serviceAccount:service-PROJECT_NUMBER@gcp-sa-healthcare.iam.gserviceaccount.com:roles/storage.admin \
  gs://PROJECT_ID_us_import_fhir_store
```

---

### Step 2: Deploy Cloud Functions

**PRODUCTION DEPLOYMENT STATUS**:

#### Agent 1: Clinical Trial Retrieval
- **Function Name**: `agent1-retrieve-trial`
- **URL**: `https://us-central1-wz-clinical-trials-skeleton.cloudfunctions.net/agent1-retrieve-trial`
- **Runtime**: Python 3.12
- **Resources**: 2 CPU, 1Gi memory, 600s timeout
- **Concurrency**: 1 request per instance
- **Max Instances**: 100
- **Status**: ✅ Deployed and operational

#### Agent 2: Patient Matching Orchestrator  
- **Function Name**: `agent2-fhir-trial-matching`
- **URL**: `https://us-central1-wz-clinical-trials-skeleton.cloudfunctions.net/agent2-fhir-trial-matching`
- **Runtime**: Python 3.12
- **Resources**: 2 CPU, 4Gi memory, 3600s timeout
- **Concurrency**: 1 request per instance
- **Max Instances**: 100
- **Architecture**: Orchestrator with ThreadPoolExecutor for parallel patient processing
- **Status**: ✅ Deployed and operational

#### Agent 3: Criterion Evaluation Worker
- **Function Name**: `agent3-evaluate-criterion`
- **URL**: `https://us-central1-wz-clinical-trials-skeleton.cloudfunctions.net/agent3-evaluate-criterion`
- **Runtime**: Python 3.12
- **Resources**: 2 CPU, 2Gi memory, 540s timeout
- **Concurrency**: 1 request per instance (worker isolation)
- **Max Instances**: 1000 (unlimited parallelization)
- **Architecture**: Stateless worker called by Agent 2 orchestrator
- **Status**: ✅ Deployed and operational

**VERIFIED API ENDPOINTS**:

ClinicalTrials.gov API v2 is confirmed working:
- **Search endpoint**: `https://clinicaltrials.gov/api/v2/studies?query.cond={condition}&filter.overallStatus=RECRUITING&pageSize=5&format=json`
- **Individual trial**: `https://clinicaltrials.gov/api/v2/studies/{nctId}?format=json`

**Test NCT IDs** (Active low back pain trials):
```
NCT06895057 - Telerehabilitation vs Clinic Core Stabilization
NCT06471920 - Telerehabilitation for Rural Communities  
NCT06276322 - All Spine Segments Assessment
NCT07229287 - Kinetic Control for Sacroiliac Joint
NCT06825390 - AuriculoTherapy NeuroImaging
```

**Confirmed API Response Structure**:
```json
{
  "protocolSection": {
    "identificationModule": {
      "nctId": "NCT06895057",
      "briefTitle": "...",
      "officialTitle": "..."
    },
    "conditionsModule": {
      "conditions": ["Low Back Pain", "Chronic Pain"]
    },
    "eligibilityModule": {
      "eligibilityCriteria": "Inclusion Criteria:\n\n* Item 1\n* Item 2\n\nExclusion Criteria:\n\n* Item 1\n* Item 2"
    },
    "armsInterventionsModule": {
      "interventions": [{"name": "...", "type": "..."}]
    },
    "contactsLocationsModule": {...}
  }
}
```

**CRITICAL FINDING**: `eligibilityCriteria` is **free-text with newlines**, requiring intelligent parsing. Format varies by trial.

**Environment Variables** (`backend/.env`):
```bash
PROJECT_ID=wz-clinical-trials-skeleton
LOCATION=us
DATASTORE_ID=fhir-synthea-store
GEMINI_MODEL=gemini-2.5-pro
CLINICALTRIALS_API_BASE=https://clinicaltrials.gov/api/v2
```

**Agent 1 Cloud Function Implementation**:

```javascript
// backend/functions/retrieveTrialData/index.js
const fetch = require('node-fetch');
const { VertexAI } = require('@google-cloud/vertexai');

const PROJECT_ID = process.env.PROJECT_ID;
const LOCATION = process.env.LOCATION || 'us-central1';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const API_BASE = process.env.CLINICALTRIALS_API_BASE;

const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION
});

exports.retrieveTrialData = async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const { nctId } = req.body;
    
    if (!nctId) {
      return res.status(400).json({ error: 'NCT ID is required' });
    }

    // Step 1: Fetch from ClinicalTrials.gov API v2
    console.log(`Fetching trial data for ${nctId}...`);
    const apiUrl = `${API_BASE}/studies/${nctId}?format=json`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov API error: ${response.status}`);
    }
    
    const data = await response.json();
    const protocol = data.protocolSection;
    
    // Step 2: Extract basic information
    const trialData = {
      nctId: protocol.identificationModule.nctId,
      title: protocol.identificationModule.briefTitle,
      officialTitle: protocol.identificationModule.officialTitle,
      conditions: protocol.conditionsModule?.conditions || [],
      status: protocol.statusModule?.overallStatus || 'UNKNOWN'
    };
    
    // Step 3: Parse criteria using Gemini 2.5 Pro
    const rawCriteria = protocol.eligibilityModule?.eligibilityCriteria || '';
    
    if (rawCriteria) {
      console.log('Parsing eligibility criteria with Gemini...');
      const parsedCriteria = await parseCriteriaWithGemini(rawCriteria);
      trialData.inclusion = parsedCriteria.inclusion;
      trialData.exclusion = parsedCriteria.exclusion;
    } else {
      trialData.inclusion = [];
      trialData.exclusion = [];
    }
    
    // Step 4: Extract interventions
    const interventions = protocol.armsInterventionsModule?.interventions || [];
    trialData.interventions = interventions.map(i => ({
      type: i.type,
      name: i.name
    }));
    
    // Step 5: Extract contacts (if available)
    const contacts = protocol.contactsLocationsModule?.centralContacts || [];
    trialData.contacts = contacts.map(c => ({
      name: c.name,
      role: c.role,
      phone: c.phone,
      email: c.email
    }));
    
    console.log(`Successfully processed ${nctId}`);
    res.json(trialData);
    
  } catch (error) {
    console.error('Error retrieving trial data:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve trial data',
      details: error.message 
    });
  }
};

async function parseCriteriaWithGemini(rawCriteria) {
  const prompt = `You are a clinical trial eligibility criteria parser. Parse the following eligibility criteria text into structured inclusion and exclusion criteria lists.

INPUT CRITERIA TEXT:
${rawCriteria}

INSTRUCTIONS:
1. Separate inclusion criteria from exclusion criteria
2. Extract each criterion as a separate item
3. Clean up formatting (remove bullets, numbers, extra whitespace)
4. Keep criteria concise but complete
5. Return ONLY valid JSON in this exact format:

{
  "inclusion": [
    "criterion 1",
    "criterion 2",
    ...
  ],
  "exclusion": [
    "criterion 1", 
    "criterion 2",
    ...
  ]
}

Do not include any explanation or markdown formatting. Return ONLY the JSON object.`;

  try {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,  // Low temperature for consistent parsing
        maxOutputTokens: 2048
      }
    });
    
    const responseText = result.response.candidates[0].content.parts[0].text;
    
    // Extract JSON from potential markdown code blocks
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(jsonText);
    
    return {
      inclusion: parsed.inclusion || [],
      exclusion: parsed.exclusion || []
    };
    
  } catch (error) {
    console.error('Gemini parsing error:', error);
    // Fallback: simple text splitting
    return fallbackParsing(rawCriteria);
  }
}

function fallbackParsing(rawCriteria) {
  // Simple fallback if Gemini fails
  const lines = rawCriteria.split('\n').filter(l => l.trim());
  const inclusion = [];
  const exclusion = [];
  let currentSection = null;
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('inclusion criteria')) {
      currentSection = 'inclusion';
    } else if (lower.includes('exclusion criteria')) {
      currentSection = 'exclusion';
    } else if (line.trim().startsWith('*') || line.trim().startsWith('-') || /^\d+\./.test(line.trim())) {
      const cleaned = line.replace(/^[\*\-\d\.]+\s*/, '').trim();
      if (cleaned && currentSection === 'inclusion') {
        inclusion.push(cleaned);
      } else if (cleaned && currentSection === 'exclusion') {
        exclusion.push(cleaned);
      }
    }
  }
  
  return { inclusion, exclusion };
}
```

**Deploy Command** (COMPLETED 2025-11-14):
```bash
cd backend/functions/agent1_retrieve_trial

gcloud functions deploy agent1-retrieve-trial \
  --gen2 \
  --runtime=python312 \
  --region=us-central1 \
  --source=. \
  --entry-point=retrieve_trial_data \
  --trigger-http \
  --allow-unauthenticated \
  --cpu=2 \
  --memory=1Gi \
  --timeout=600s \
  --max-instances=100 \
  --concurrency=1 \
  --env-vars-file=.env.yaml
```

**Deployed Function Details**:
- **Project**: `wz-clinical-trials-skeleton`
- **URL**: `https://us-central1-wz-clinical-trials-skeleton.cloudfunctions.net/agent1-retrieve-trial`
- **Status**: ACTIVE ✓
- **Runtime**: Python 3.12
- **Memory**: 1Gi
- **CPU**: 2
- **Timeout**: 600s
- **Features**:
  - Gemini 2.5 Pro with thinking mode for criteria parsing
  - Streaming logs for transparency
  - Fallback parsing if LLM fails
  - 7-step thinking process captured

**Test Results**:
```bash
curl -X POST https://us-central1-wz-clinical-trials-skeleton.cloudfunctions.net/agent1-retrieve-trial \
  -H "Content-Type: application/json" \
  -d '{"nctId": "NCT06895057"}'

# Returns:
# - 15 total criteria (5 inclusion + 10 exclusion)
# - Trial title, status, conditions
# - Interventions and contact info
```

---

### Step 3: Deploy Frontend to Firebase

1. **Initialize Firebase**:
```bash
cd frontend
firebase init hosting

# Select:
# - Use existing project: uw-clinical-trials-demo
# - Public directory: dist
# - Single-page app: Yes
# - Set up GitHub Actions: No (optional)
```

2. **Configure API Endpoints** (`frontend/.env.production`):
```bash
VITE_API_RETRIEVE_TRIAL=https://us-central1-uw-clinical-trials-demo.cloudfunctions.net/retrieveTrialData
VITE_API_SEMANTIC_SEARCH=https://us-central1-uw-clinical-trials-demo.cloudfunctions.net/semanticPatientSearch
VITE_API_MATCH_CRITERIA=https://us-central1-uw-clinical-trials-demo.cloudfunctions.net/matchCriteriaByPatient
VITE_API_GENERATE_DOCS=https://us-central1-uw-clinical-trials-demo.cloudfunctions.net/generatePaperwork
```

---

## Research-Based Implementation Details

### Key Insights from Research Papers

#### 1. From Panacea (2407.11007v1.pdf)
- **Multi-task learning**: Train on trial search, summarization, design, and matching
- **TrialInstruct dataset**: 200K+ instruction data for fine-tuning
- **Performance**: 14.42% improvement in patient-trial matching over baselines
- **Implementation**: Use similar criterion-level evaluation approach

#### 2. From TrialGPT (s41467-024-53081-z.pdf)
- **Three-stage pipeline**: Retrieval → Matching → Ranking
- **Retrieval**: Hybrid BM25 + semantic search recalls >90% with <6% of corpus
- **Matching**: 87.3% accuracy on criterion-level predictions
- **Key finding**: LLM-based re-ranking improved nDCG@10 to 0.7275
- **Implementation**: Adopt retrieval-augmented generation (RAG) approach

#### 3. From TrialMatchAI (2505.08508v1.pdf)
- **Open-source focus**: Use lightweight models (Phi-4, Gemma-2-2B)
- **RAG integration**: BioBERT for entity recognition + embeddings
- **Performance**: 87% accuracy with 8B parameter models
- **Zero-shot capability**: 92% of patients had relevant trial in top 20
- **Implementation**: Fine-tune small models, use local deployment

#### 4. From LLM-Match (2503.13281v3.pdf)
- **Classification head**: Fine-tuned LLM with classification layer
- **RAG for EHR**: Top-k chunk retrieval from patient records
- **Performance**: Macro-F1 of 0.86 on n2c2 benchmark
- **Key approach**: Structured prompts + ground-truth labels for fine-tuning
- **Implementation**: Use similar prompt engineering for Gemini

#### 5. From Healthcare Literacy (Health Literacy Life Sciences 20-AUG-2025.pdf)
- **Barriers**: 76% of trials have protocol amendments
- **Cost**: $40K/day in opportunity costs for delayed trials
- **Only 1/4 patients**: Are achievable candidates due to barriers
- **Implementation**: Streamline matching to reduce barriers

#### 6. From Patient Barriers Meta-Analysis (djy221.pdf)
- **Structural barriers**: 55.6% have no trial available at institution
- **Clinical barriers**: 21.5% ineligible for available trials
- **Patient/Physician**: Only 14.8% eligible but not enrolled
- **Key insight**: 77% of non-participation due to structural/clinical factors
- **Implementation**: Focus on improving trial availability awareness

### Prompt Engineering Best Practices

Based on research, our Chain-of-Thought prompts should:

1. **Structure** (from TrialGPT):
```
System: You are a clinical trial eligibility expert.

Task: Analyze patient eligibility for trial criteria.

Input: 
- Patient FHIR bundle
- Trial criteria (inclusion/exclusion)

Process:
1. Extract evidence from FHIR resources
2. Think step-by-step for each criterion
3. Cite specific FHIR resource locations
4. Make definitive classification

Output: JSON with per-criterion analysis
```

---

## Appendix: Sample Data Structures

### Trial JSON Structure
```json
{
  "nctId": "NCT04432597",
  "title": "Low Back Pain Patient Education Evaluation",
  "status": "RECRUITING",
  "phase": "N/A",
  "conditions": ["Low Back Pain", "Chronic Pain"],
  "interventions": [
    {
      "type": "BEHAVIORAL",
      "name": "Patient Education Program"
    }
  ],
  "inclusion_criteria": [
    "Adults aged 18-65",
    "Chronic low back pain for >6 months",
    "Pain score ≥4 on 10-point scale"
  ],
  "exclusion_criteria": [
    "Prior spinal surgery",
    "Active litigation",
    "Pregnancy"
  ],
  "contacts": [
    {
      "name": "Study Coordinator",
      "phone": "(206) 555-0100",
      "email": "trials@uwmedicine.org"
    }
  ]
}
```

### Patient FHIR Bundle (Simplified)
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "P-001234",
        "birthDate": "1982-03-15",
        "gender": "female"
      }
    },
    {
      "resource": {
        "resourceType": "Condition",
        "id": "C-789",
        "code": {
          "coding": [
            {
              "system": "http://snomed.info/sct",
              "code": "279039007",
              "display": "Low back pain"
            }
          ]
        },
        "onsetDateTime": "2023-01-10"
      }
    },
    {
      "resource": {
        "resourceType": "Procedure",
        "id": "PR-456",
        "code": {
          "coding": [
            {
              "system": "http://snomed.info/sct",
              "code": "58899000",
              "display": "Lumbar spinal fusion"
            }
          ]
        },
        "performedDateTime": "2022-08-15"
      }
    }
  ]
}
```

### Criterion Analysis Result
```json
{
  "patientId": "P-001234",
  "overallStatus": "EXCLUDED",
  "criteriaAnalysis": [
    {
      "criterion": "Adults aged 18-65",
      "status": "MET",
      "evidence": "Patient birthDate: 1982-03-15 (Age: 42)",
      "fhirReference": "Patient/P-001234"
    },
    {
      "criterion": "Chronic low back pain for >6 months",
      "status": "MET",
      "evidence": "Condition onsetDateTime: 2023-01-10 (22 months ago)",
      "fhirReference": "Condition/C-789"
    },
    {
      "criterion": "No prior spinal surgery",
      "status": "NOT_MET",
      "evidence": "Lumbar spinal fusion performed 2022-08-15",
      "fhirReference": "Procedure/PR-456"
    }
  ],
  "reasoning": "Patient meets age and duration requirements but has exclusion criterion of prior spinal surgery (L4-L5 fusion in August 2022). Therefore excluded from trial."
}
```
