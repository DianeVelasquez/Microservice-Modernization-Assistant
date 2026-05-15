import type { ExtractedField, FieldExtractionSource } from "../tools/fieldExtractor.js";
import { OperationNameDiscoveryTool } from "../tools/operationNameDiscovery.js";
import { BddScenarioExtractorTool } from "../tools/bddScenarioExtractor.js";
import { OperationDetailExtractorTool } from "../tools/operationDetailExtractor.js";
import { FieldExtractorTool } from "../tools/fieldExtractor.js";
import type { WatsonxChatModel } from "beeai-framework/adapters/watsonx/backend/chat";
import type { SourceData } from "./reader.js";
import type { ResolvedFlowDefinition } from "../types/index.js";

export interface AnalyzerAgentInput {
  sourceData: SourceData;
  flowDefinition: ResolvedFlowDefinition;
}

export interface AnalysisResult {
  extractedFields: ExtractedField[];
  summary: string;
}

/**
 * AnalyzerAgent - Acts as a dispatcher, selecting the correct specialized tool
 * for the analysis task based on the current flow.
 */
export class AnalyzerAgent {
  private fieldExtractor: FieldExtractorTool;
  private operationNameDiscovery: OperationNameDiscoveryTool;
  private bddScenarioExtractor: BddScenarioExtractorTool;
  private operationDetailExtractor: OperationDetailExtractorTool;
  private apiKey: string;
  private model: string;
  private projectId: string;
  private baseUrl?: string;

  constructor(_llm: WatsonxChatModel) {
    this.fieldExtractor = new FieldExtractorTool();
    this.operationNameDiscovery = new OperationNameDiscoveryTool();
    this.bddScenarioExtractor = new BddScenarioExtractorTool();
    this.operationDetailExtractor = new OperationDetailExtractorTool();
    
    this.apiKey = process.env.WATSONX_API_KEY || "";
    this.model = process.env.WATSONX_CHAT_MODEL || "ibm/granite-20b-code-instruct";
    this.projectId = process.env.WATSONX_PROJECT_ID || "";
    this.baseUrl = process.env.WATSONX_URL;
  }

  async analyze(input: AnalyzerAgentInput): Promise<AnalysisResult> {
    const { sourceData, flowDefinition } = input;
    let allExtractedFields: ExtractedField[] = [];

    console.log("\n[AnalyzerAgent] Starting intelligent analysis...");
    const baseFlowName = flowDefinition.name.split('-')[0];
    console.log(`[Flow] ${flowDefinition.name} (Base: ${baseFlowName})`);

    // Prepare sources for all tools
    const llmSources: FieldExtractionSource[] = [];
    if (sourceData.build) llmSources.push({ name: "build.json", data: sourceData.build, description: "Azure DevOps Build Pipeline definition." });
    if (sourceData.release) llmSources.push({ name: "release.json", data: sourceData.release, description: "Azure DevOps Release Pipeline definition." });
    
    const repoFileSources: FieldExtractionSource[] = sourceData.repoFiles.map(file => ({
        name: `repository file: ${file.relativePath}`,
        description: file.relativePath,
        data: file.content || ''
    }));
    const combinedSources = [...llmSources, ...repoFileSources];

    // --- Dispatcher Logic ---
    if (baseFlowName === 'serviceMetadata') {
      // For serviceMetadata, we discover operation names and extract other simple fields.
      allExtractedFields = await this.analyzeServiceMetadata(sourceData, flowDefinition, combinedSources, repoFileSources);

    } else if (baseFlowName === 'bddScenarios') {
      // For bddScenarios, we use the dedicated BDD extractor.
      allExtractedFields = await this.analyzeBddScenarios(sourceData, flowDefinition, repoFileSources);

    } else if (baseFlowName === 'operationDiscovery') {
      // For operationDiscovery, we use the dedicated operation detail extractor.
      allExtractedFields = await this.analyzeOperationDetails(sourceData, flowDefinition, repoFileSources);

    } else {
      // New product packs should be mostly configuration-driven. If a flow does
      // not need a specialized extractor, use the generic schema-based extractor.
      allExtractedFields = await this.analyzeGenericFlow(sourceData, flowDefinition, combinedSources);
    }
    
    console.log(`\n[OK] Analysis completed successfully. Extracted ${allExtractedFields.length} total fields.`);

    return {
      extractedFields: allExtractedFields,
      summary: `Analyzed flow ${flowDefinition.name} and extracted ${allExtractedFields.length} fields.`,
    };
  }

  /**
   * De-duplicates an array of extracted fields using a Map to ensure uniqueness.
   * This logic prioritizes keeping the first valid (non-null/empty) value encountered for each field.
   */
  private deDuplicateFields(fields: ExtractedField[]): ExtractedField[] {
    const fieldMap = new Map<string, ExtractedField>();
    for (const field of fields) {
      const fieldName = field.fieldName;
      const existingField = fieldMap.get(fieldName);

      // If we haven't seen this field yet, add it.
      if (!existingField) {
        fieldMap.set(fieldName, field);
      } else {
        // If we have seen it, only overwrite it if the existing value is bad (null/empty)
        // and the new value is good.
        const existingValue = existingField.value;
        const newValue = field.value;
        if ((existingValue === null || existingValue === '') && (newValue !== null && newValue !== '')) {
          fieldMap.set(fieldName, field);
        }
      }
    }
    return Array.from(fieldMap.values());
  }

  private async analyzeServiceMetadata(sourceData: SourceData, flowDefinition: ResolvedFlowDefinition, combinedSources: FieldExtractionSource[], repoFileSources: FieldExtractionSource[]): Promise<ExtractedField[]> {
    const extractedFields: ExtractedField[] = [];
    
    console.log("[AnalyzerAgent] Running specialized operation discovery...");
    const opsResult = await this.operationNameDiscovery.run({
      repoFiles: repoFileSources,
      apiKey: this.apiKey, model: this.model, projectId: this.projectId, baseUrl: this.baseUrl,
    });
    if (!opsResult.success) throw new Error(`Operation discovery failed: ${opsResult.error}`);
    console.log(`[OperationNameDiscoveryTool] Found ${opsResult.operations.length} operations.`);
    extractedFields.push({ fieldName: 'operations', value: opsResult.operations, source: 'repository analysis', confidence: 'medium', reasoning: `Discovered ${opsResult.operations.length} ops.` });

    const { operations, ...schemaForExtractor } = sourceData.schema.data;
    if (Object.keys(schemaForExtractor).length > 0) {
      console.log("[AnalyzerAgent] Extracting remaining simple fields for serviceMetadata...");
      const fieldResult = await this.fieldExtractor.run({
        schema: schemaForExtractor, sources: combinedSources, flowDefinition,
        apiKey: this.apiKey, model: this.model, projectId: this.projectId, baseUrl: this.baseUrl,
      });
      if (!fieldResult.success) throw new Error(`Field extraction failed: ${fieldResult.error}`);
      extractedFields.push(...fieldResult.extractedFields);
    }
    return this.deDuplicateFields(extractedFields);
  }

  private async analyzeGenericFlow(sourceData: SourceData, flowDefinition: ResolvedFlowDefinition, combinedSources: FieldExtractionSource[]): Promise<ExtractedField[]> {
    console.log("[AnalyzerAgent] Running generic schema-based extraction...");
    const fieldResult = await this.fieldExtractor.run({
      schema: sourceData.schema.data,
      sources: combinedSources,
      flowDefinition,
      apiKey: this.apiKey,
      model: this.model,
      projectId: this.projectId,
      baseUrl: this.baseUrl,
    });

    if (!fieldResult.success) throw new Error(`Field extraction failed: ${fieldResult.error}`);
    return this.deDuplicateFields(fieldResult.extractedFields);
  }

  private async analyzeBddScenarios(sourceData: SourceData, flowDefinition: ResolvedFlowDefinition, repoFileSources: FieldExtractionSource[]): Promise<ExtractedField[]> {
    console.log("[AnalyzerAgent] Running specialized BDD Scenario Extractor...");
    const bddResult = await this.bddScenarioExtractor.run({
      repoFiles: repoFileSources,
      schema: sourceData.schema.data,
      flowDefinition,
      apiKey: this.apiKey, model: this.model, projectId: this.projectId, baseUrl: this.baseUrl,
    });

    if (!bddResult.success || !bddResult.data) {
      throw new Error(`BDD Scenario extraction failed: ${bddResult.error}`);
    }
    console.log(`[BddScenarioExtractorTool] Extracted modular/integration scenarios.`);

    // Convert the direct data output into the ExtractedField[] format
    const result: ExtractedField[] = [];
    result.push({ fieldName: 'operationName', value: flowDefinition.operationName, source: 'context', confidence: 'high', reasoning: 'Provided by execution context.' });
    for (const [key, value] of Object.entries(bddResult.data)) {
        result.push({
            fieldName: key,
            value: value,
            source: 'llm-extraction',
            confidence: 'medium',
            reasoning: 'Extracted by BddScenarioExtractorTool.'
        });
    }
    return this.deDuplicateFields(result);
  }

  private async analyzeOperationDetails(sourceData: SourceData, flowDefinition: ResolvedFlowDefinition, repoFileSources: FieldExtractionSource[]): Promise<ExtractedField[]> {
    console.log("[AnalyzerAgent] Running specialized Operation Detail Extractor...");
    const detailResult = await this.operationDetailExtractor.run({
        repoFiles: repoFileSources,
        schema: sourceData.schema.data,
        flowDefinition,
        apiKey: this.apiKey, model: this.model, projectId: this.projectId, baseUrl: this.baseUrl,
    });

    if (!detailResult.success || !detailResult.data) {
        throw new Error(`Operation Detail extraction failed: ${detailResult.error}`);
    }
    console.log(`[OperationDetailExtractorTool] Extracted details for operation ${flowDefinition.operationName}.`);

    // Convert the direct data output into the ExtractedField[] format
    const result: ExtractedField[] = [];
    result.push({ fieldName: 'operationName', value: flowDefinition.operationName, source: 'context', confidence: 'high', reasoning: 'Provided by execution context.' });
    for (const [key, value] of Object.entries(detailResult.data)) {
        result.push({
            fieldName: key,
            value: value,
            source: 'llm-extraction',
            confidence: 'medium',
            reasoning: 'Extracted by OperationDetailExtractorTool.'
        });
    }
    return this.deDuplicateFields(result);
  }
}
