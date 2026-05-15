# Skill Registry — Microservice Modernization Assistant

## Project Context

- Stack: Node.js + TypeScript ESM.
- Runtime entrypoint: `src/index.ts` via `tsx` during development.
- Architecture: configurable multi-agent modernization pipeline.
- Main flow: `FlowOrchestrator -> FlowExecutor -> ReaderAgent -> AnalyzerAgent -> WriterAgent -> ArtifactGeneratorAgent`.
- Product behavior is intended to live mostly in configuration: flows, schemas, templates.

## Testing / Verification

- `npm run build` exists but should not be run automatically in this workspace per user/global instruction.
- `npm test` is a placeholder that exits with failure (`Error: no test specified`).
- TypeScript is strict (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`).
- No dedicated test runner was detected.

## Compact Rules

### TypeScript Architecture Rules

- Preserve the config-driven product-pack design: flows, schemas, and templates should own product behavior where practical.
- Avoid hard-coding provider-specific logic into agents or workflows; introduce provider abstractions at boundaries.
- Keep ESM imports with `.js` suffix for local TypeScript modules where the project already does so.
- Respect strict TypeScript settings; avoid unused params/locals unless intentionally prefixed with `_`.

### LLM Provider Rules

- Current code is coupled to WatsonX through `src/config/llm.ts`, agent constructor types, validators, and extractor tools.
- New LLM work should depend on a small provider-agnostic chat interface instead of `WatsonxChatModel` directly.
- Provider-specific credentials and defaults belong in config/factory code, not in extraction or workflow logic.
- README and setup docs must reflect provider-neutral configuration when provider support changes.

### Review / Delivery Rules

- Keep changes reviewable; if provider abstraction touches many files, split into slices: interface/factory, migration of consumers, docs/config.
- Do not build automatically.

## User Skills Trigger Table

| Context | Skills |
|---|---|
| SDD planning or implementation | `sdd-*`, `work-unit-commits` |
| TypeScript code changes | TypeScript Architecture Rules, LLM Provider Rules |
| Documentation updates | `cognitive-doc-design` |
| PR creation or review slicing | `branch-pr`, `chained-pr`, `work-unit-commits` |
