# Architecture: Microservice Modernization Assistant

The system is a configurable multi-agent pipeline for turning repository evidence into modernization artifacts.

The core design choice is to keep product behavior in configuration wherever possible: flows define the work, schemas define what to extract, and templates define what to generate.

## Execution Model

```text
FlowOrchestrator
  -> FlowExecutor
    -> ReaderAgent
    -> AnalyzerAgent
    -> WriterAgent
    -> ArtifactGeneratorAgent
```

| Stage | Role |
|-------|------|
| ReaderAgent | Loads schema, build/release metadata, and repository files filtered by `sourceHints`. |
| AnalyzerAgent | Uses specialized extractors when available; otherwise falls back to generic schema-based extraction. |
| WriterAgent | Converts extracted fields into the schema-shaped intermediate JSON output. |
| ArtifactGeneratorAgent | Maps JSON fields into templates and writes final artifacts. |

## Product Pack Structure

A product pack is composed of three assets:

| Asset | Purpose |
|-------|---------|
| Flow | Defines execution, sources, outputs, and templates. |
| Schema | Defines the modernization data model and source discovery hints. |
| Template | Defines the customer-facing artifact generated from the extracted data. |

The first pack is `modernizationAssessment`:

```text
specs/flow-configuration.json
specs/schemas/modernization-assessment.json
specs/templates/ModernizationAssessment/
```

## Current Flow

```text
resources/build.json
resources/release.json
resources/repo/
        |
        v
modernizationAssessment flow
        |
        v
output/intermediate-data/modernization-assessment.json
output/artifacts/modernization-assessment/*.md
```

## Why This Shape

The product needs to evolve from one proven client automation into multiple sellable assistants. Keeping the engine stable and moving domain behavior into packs avoids rewriting the pipeline for every client or use case.

## Extension Path

Next product packs can reuse the same engine:

- QA Automation Assistant: BDD, Karate, SOAP, and route-critical artifacts.
- Client-Specific Automation Factory: client-specific schemas, templates, validators, and delivery conventions.

## Known Couplings To Reduce Later

- Some legacy templates and schemas still describe SOAP, Scaffold, BDD, Karate, and banking migration concerns.
- Some analyzer strategies are still hardcoded for legacy flow names.
- Source types are currently limited to `build`, `release`, and `repo`.
- Validation still contains legacy operation-discovery rules.

Those are intentional follow-up refactors. The MVP keeps the smallest viable modernization product slice first.
