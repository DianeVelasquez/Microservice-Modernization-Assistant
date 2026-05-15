# Bee Agent for Scaffold - Documentation (v2)

Documentación completa del sistema **Bee Agent for Scaffold**, una plataforma multi-agente para migración a Clean Architecture usando **Bee Framework 0.1.20** e **IBM WatsonX**.

Esta versión introduce un **MasterOrchestratorAgent** que dirige la ejecución de flujos de trabajo complejos, dinámicos y secuenciales.

---

## 📚 Índice

- [Arquitectura General](#-arquitectura-general)
- [El Orquestador Maestro](#-el-orquestador-maestro-masterorchestratoragent)
- [Configuración de la Orquestación](#-configuración-de-la-orquestación-orchestrationsteps)
- [El Pipeline de Ejecución de Flujos](#-el-pipeline-de-ejecución-de-flujos)
- [Framework de Validación](#-framework-de-validación)
- [Flujo de Ejecución Detallado](#-flujo-de-ejecución-detallado)
- [Inicio Rápido](#-inicio-rápido)

---

## 🏗️ Arquitectura General

El sistema ha evolucionado a una arquitectura dirigida por un agente "cerebro" (`MasterOrchestratorAgent`) que ejecuta una serie de pasos configurables. Cada paso puede invocar uno o más flujos de trabajo que siguen el pipeline de 4 fases original.

```
┌──────────────────────────────────────────────────┐
│           MASTER ORCHESTRATOR AGENT              │
│  - Lee `orchestrationSteps` de la configuración  │
│  - Ejecuta pasos en secuencia                    │
│  - Maneja lógica de reintentos y validación      │
│  - Gestiona flujos dinámicos (ej: por operación) │
└──────────────────────────────────────────────────┘
                   │
                   ▼ (Para cada flujo en un paso)
┌──────────────────────────────────────────────────┐
│                 FLOW ORCHESTRATOR                │
│  - Recibe un solo flujo y un contexto dinámico   │
│  - Resuelve placeholders (ej: {operationName})   │
│  - Llama a FlowExecutor                          │
└──────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│                   FLOW EXECUTOR                  │
│       (Pipeline de 4 Fases para un flujo)        │
└──────────────────────────────────────────────────┘
      │
      ├─▶ FASE 1: ReaderAgent (Leer fuentes)
      │
      ├─▶ FASE 2: AnalyzerAgent (Extraer con LLM)
      │
      ├─▶ FASE 3: WriterAgent (Construir JSON intermedio)
      │
      └─▶ FASE 4: ArtifactGeneratorAgent (Generar artefactos)
```

---

## 🧠 El Orquestador Maestro (MasterOrchestratorAgent)

Es el nuevo punto de entrada y cerebro del sistema. Sus responsabilidades son:

- **Orquestación por Pasos**: Lee una lista de `orchestrationSteps` del archivo `flow-configuration.json` y los ejecuta en orden.
- **Ejecución Dinámica**: Puede ejecutar un paso múltiples veces basado en los resultados de un paso anterior. Por ejemplo, ejecutar los flujos de `operationDiscovery` y `bddScenarios` para cada una de las operaciones encontradas por el flujo `serviceMetadata`.
- **Validación Multi-capa**: Al final de cada paso, ejecuta un framework de validación configurable para asegurar la calidad y consistencia de los resultados.
- **Lógica de Reintentos**: Gestiona una política de reintentos para cada paso, volviendo a ejecutar los flujos si la validación falla.
- **Reporte Final**: Genera un reporte consolidado de la ejecución de todos los pasos, flujos y validaciones.

---

## ⚙️ Configuración de la Orquestación (`orchestrationSteps`)

La ejecución ahora se controla a través de la sección `orchestrationSteps` en `specs/flow-configuration.json`.

Un `step` (paso) tiene la siguiente estructura:

```json
{
  "name": "operationProcessing",
  "description": "Procesar cada operación: discovery + BDD scenarios",
  "flows": ["operationDiscovery", "bddScenarios"],
  "executionMode": "parallel",
  "dynamicScope": {
    "forEach": "discoveredOperations",
    "variable": "operationName"
  },
  "retryPolicy": {
    "enabled": true,
    "maxAttempts": 3
  },
  "validation": {
    "fileExistence": true,
    "schemaCompliance": true,
    "contentQuality": true,
    "crossFlowValidation": true
  },
  "onSuccess": {
    "extractOperations": {
      "sourceFile": "output/intermediate-data/service-metadata.json",
      "field": "operations",
      "storeAs": "discoveredOperations"
    }
  }
}
```

- **`flows`**: Lista de flujos a ejecutar en este paso.
- **`executionMode`**: `"sequential"` o `"parallel"`.
- **`dynamicScope`**: Define la ejecución dinámica. Itera sobre una variable de contexto (ej. `discoveredOperations`) y expone cada ítem como `variable` (ej. `operationName`).
- **`validation`**: Activa las diferentes capas de validación para este paso.
- **`onSuccess`**: Acciones a ejecutar si el paso es exitoso. `extractOperations` permite leer un JSON de salida y guardar un array en el contexto para ser usado por el `dynamicScope` del siguiente paso.

---

## ቧ El Pipeline de Ejecución de Flujos

Aunque la orquestación ha cambiado, el núcleo de la ejecución para un flujo individual sigue siendo el pipeline de 4 fases gestionado por el `FlowExecutor`.

- **FASE 1: `ReaderAgent`**: Recolecta datos de las fuentes (`build.json`, `release.json`, archivos del repo).
- **FASE 2: `AnalyzerAgent`**: Usa **IBM WatsonX** para analizar las fuentes y extraer los campos definidos en el esquema del flujo.
- **FASE 3: `WriterAgent`**: Construye el archivo JSON intermedio (ej. `service-metadata.json`) con los datos extraídos.
- **FASE 4: `ArtifactGeneratorAgent`**: Usa las plantillas de Bee Agent (`.bbt`) para generar los artefactos finales (`.feature`, `.xml`, etc.) a partir del JSON intermedio.

---

## ✅ Framework de Validación

El `MasterOrchestratorAgent` introduce un potente sistema de validación que se ejecuta al final de cada paso.

- **`fileExistence`**: Verifica que los archivos intermedios y los artefactos finales hayan sido creados en el disco.
- **`schemaCompliance`**: Valida que el contenido de los archivos JSON intermedios cumpla con su esquema (`jsonschema`).
- **`contentQuality` (LLM)**: Utiliza un LLM para realizar una revisión de "sentido común" sobre el contenido de los archivos generados, buscando valores vacíos, placeholders sin reemplazar o datos incoherentes.
- **`crossFlowValidation` (LLM)**: La validación más avanzada. Comprueba la consistencia *entre* los resultados de diferentes flujos. Por ejemplo, verifica que para cada operación encontrada en el paso 1, se hayan creado los archivos correspondientes en el paso 2.

---

## 🚀 Flujo de Ejecución Detallado

La ejecución con `npm run dev` ahora sigue esta lógica:

1.  **`MasterOrchestratorAgent.execute()`**
    │
    ├─ Carga `flow-configuration.json` incluyendo `orchestrationSteps`.
    │
    ├─ **Inicia Bucle de Pasos**:
    │  │
    │  ├─ **Paso 1: `serviceDiscovery`**
    │  │  ├─ Llama a `FlowOrchestrator` para ejecutar el flujo `serviceMetadata`.
    │  │  │  └─ `FlowExecutor` ejecuta el pipeline de 4 fases, creando `output/intermediate-data/service-metadata.json`.
    │  │  ├─ Se ejecutan las validaciones para este paso.
    │  │  └─ La acción `onSuccess` lee el JSON, extrae el array `operations` y lo guarda en el contexto como `discoveredOperations`.
    │  │
    │  └─ **Paso 2: `operationProcessing`**
    │     ├─ El `dynamicScope` detecta el array `discoveredOperations`.
    │     ├─ **Inicia Bucle Dinámico** (para cada `operationName` en `discoveredOperations`):
    │     │  └─ Llama a `FlowOrchestrator` en paralelo para los flujos `operationDiscovery` y `bddScenarios`, pasando el `operationName` actual en el contexto.
    │     │     └─ `FlowOrchestrator` resuelve el placeholder `{operationName}` en las rutas de salida y ejecuta los flujos.
    │     └─ Al terminar el bucle, se ejecutan las validaciones, incluyendo la `crossFlowValidation` para asegurar que todas las operaciones se procesaron.
    │
    └─ Genera el reporte final de ejecución.

---

## 📖 Inicio Rápido

### Prerequisitos

```bash
# Node.js 18+
# npm o yarn
```

### Instalación

```bash
npm install
```

### Configuración

1.  **Variables de entorno** (`.env`):
    ```env
    WATSONX_API_KEY=tu_api_key
    WATSONX_PROJECT_ID=tu_project_id
    WATSONX_CHAT_MODEL=ibm/granite-20b-code-instruct
    ```

2.  **Configurar orquestación** (`specs/flow-configuration.json`): Define los `orchestrationSteps` y los `flows` según tus necesidades.

### Ejecución

El `MasterOrchestratorAgent` ahora es el modo de ejecución por defecto.

```bash
# Ejecutar toda la orquestación
npm run dev
```

---
**Última actualización**: Noviembre 2025
**Versión**: 2.0.0