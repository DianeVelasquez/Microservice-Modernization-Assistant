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
- Extracts modernization assessment data with a configurable LLM provider.
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

Create `.env` with your LLM provider configuration. The app reads the generic `LLM_*` variables first, then provider-specific fallbacks.

Supported `LLM_PROVIDER` values are `openai`, `openai-compatible`, `anthropic`, `gemini`, and `watsonx`. Convenience aliases are also accepted: `gpt`, `claude`, and `google`.

OpenAI / GPT:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=your-openai-api-key
```

OpenAI-compatible providers work with Ollama, LM Studio, vLLM, and compatible gateways:

```env
LLM_PROVIDER=openai-compatible
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
```

For local providers that do not require an API key, omit `LLM_API_KEY` and point `LLM_BASE_URL` at the local OpenAI-compatible endpoint.

Claude / Anthropic:

```env
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-latest
LLM_API_KEY=your-anthropic-api-key
```

Gemini:

```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-pro
LLM_API_KEY=your-gemini-api-key
```

WatsonX remains available as an optional provider:

```env
LLM_PROVIDER=watsonx
WATSONX_API_KEY=your-api-key
WATSONX_PROJECT_ID=your-project-id
LLM_MODEL=ibm/granite-3-3-8b-instruct
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
