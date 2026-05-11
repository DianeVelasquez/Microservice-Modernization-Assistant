# Microservice Modernization Assistant

Microservice Modernization Assistant is a configurable multi-agent assistant that inspects legacy microservice repositories and generates modernization assessment artifacts.

The first product increment focuses on one useful outcome: a first-pass modernization report that helps an engineering team understand what a service is, how it is built, where it integrates, what risks exist, and what modernization path should be explored next.

## Product Direction

This project is being productized in stages:

1. Microservice Modernization Assistant
2. QA Automation Assistant
3. Client-Specific Automation Factory

The current codebase keeps the reusable engine from the original automation while introducing a modernization-focused product pack.

## What It Does Now

- Reads configured sources from `resources/build.json`, `resources/release.json`, and `resources/repo`.
- Uses `sourceHints` to focus repository discovery on relevant files.
- Extracts modernization assessment data with WatsonX.
- Writes an intermediate JSON assessment.
- Generates a Markdown modernization report.

## Architecture

```text
Reader -> Analyzer -> Writer -> ArtifactGenerator
```

| Component | Responsibility |
|-----------|----------------|
| Reader | Loads schemas and source files using `sourceHints`. |
| Analyzer | Extracts structured findings from the source data. |
| Writer | Builds and validates intermediate JSON. |
| ArtifactGenerator | Renders final artifacts from templates. |

## Current Product Pack

| Asset | Path |
|-------|------|
| Flow | `specs/flow-configuration.json` |
| Schema | `specs/schemas/modernization-assessment.json` |
| Template | `specs/templates/ModernizationAssessment/template.bbt` |
| Output JSON | `output/intermediate-data/modernization-assessment.json` |
| Output report | `output/artifacts/modernization-assessment/` |

## Setup

Install dependencies:

```bash
npm install
```

Create `.env` with WatsonX credentials:

```env
WATSONX_API_KEY=your-api-key
WATSONX_PROJECT_ID=your-project-id
WATSONX_CHAT_MODEL=ibm/granite-3-3-8b-instruct
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

Place the target service inputs under `resources/`:

```text
resources/
├── build.json
├── release.json
└── repo/
```

Run the assistant:

```bash
npm run dev
```

## Modernization Assessment Fields

The MVP assessment extracts:

- service name
- business capability
- current architecture
- technology stack
- integration points
- deployment signals
- modernization drivers
- technical risks
- recommended modernization path
- next actions

## Legacy Automation Assets

The repository still contains the original service, operation, BDD, Karate, and SOAP-oriented assets. They are intentionally preserved because they are candidates for the future QA Automation Assistant product line.

They are no longer the primary product framing of this repository.
