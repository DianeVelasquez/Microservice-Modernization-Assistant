import { WatsonxChatModel } from "beeai-framework/adapters/watsonx/backend/chat";
import { UserMessage } from "beeai-framework/backend/message";
import type { FieldExtractionSource } from "./fieldExtractor.js";

export interface OperationNameDiscoveryInput {

  repoFiles: FieldExtractionSource[];

  apiKey: string;

  model?: string;

  projectId?: string;

  baseUrl?: string;

}



export interface OperationNameDiscoveryOutput {

  success: boolean;

  operations: string[];

  error?: string;

  rawResponse?: string;

}



/**

 * OperationNameDiscoveryTool

 * A specialized tool that uses an LLM to discover service operation names

 * from a repository's file structure and content.

 */

export class OperationNameDiscoveryTool {

  name = "OperationNameDiscovery";

  description = "Discovers service operation names by analyzing repository structure and file content.";



  private buildPrompt(repoFiles: FieldExtractionSource[]): string {

    const filePaths = repoFiles.map(f => `- ${f.description}`).join('\n');



    // Create a summarized view of file contents with comments

    const fileContents = repoFiles.map(f => {

      // Show more content for feature and java files

      const isFeatureOrJava = f.description?.endsWith('.feature') || f.description?.endsWith('.java');

            const content = f.data || '';

            const lines = content.split('\n');

            const relevantLines = lines.filter((line: string) => 

              line.trim().startsWith('#') || // Gherkin comments

              line.trim().startsWith('//') || // Java comments

              line.trim().startsWith('/*') || // Java comments

              line.trim().toLowerCase().includes('operation')

            );

            

            if (relevantLines.length === 0 && isFeatureOrJava) {

              return `---

      File: ${f.description}

      (No relevant comments or 'operation' keywords found)

      ---`;

            }

            

            if (relevantLines.length > 0) {

              return `---

      File: ${f.description}

      Content Snippet (comments & keywords):

      ${relevantLines.slice(0, 15).join('\n')}

      ---`;

            }

            return null;

          }).filter(Boolean).join('\n');

      

          return `You are an expert software engineer specialized in analyzing repository structures to identify service operations.

      

      Your ONLY task is to identify all unique operation names from the provided file list and file content snippets.

      

      ## SEARCH STRATEGY

      You MUST derive the operation names by following these clues, in order of importance:

      

      1.  **Sub-directory Names**: Look at the file paths. Sub-directories inside a 'messages' or 'features' folder are strong indicators of operation names. For example, a path like '.../messages/manageAccount/' strongly suggests an operation named "manageAccount".

      

      2.  **File Names**: The base name of a '.feature' or '.wsdl' file is often an operation name. For example, 'GetUserDetails.feature' suggests "GetUserDetails".

      

      3.  **File Content**: Analyze the content snippets provided, especially comments.

          - In '.feature' files, look for comments like '# Operation: create-user'.

          - In '.java' files, look for comments like '// This step definition is for the 'update-profile' operation'.

      

      ## FILE PATHS OVERVIEW

      Here is a list of all relevant file paths in the repository:

      ${filePaths}

      

      ## FILE CONTENT SNIPPETS

      Here are snippets from relevant files containing comments or keywords:

      ${fileContents}

      

      ## OUTPUT FORMAT

      Your response MUST be a single, valid JSON array of strings, and nothing else. Do not add explanations or markdown.

      

      Example of a valid response:

      ["operationOne", "operationTwo", "operationThree"]

      

      Now, analyze the provided data and return the JSON array of operation names.

      `;

        }

      

        private parseLLMResponse(response: string): string[] {

          try {

            // Find the JSON array in the response string

            const jsonMatch = response.match(/\[[\s\S]*\]/);

            if (!jsonMatch) {

              console.warn("OperationNameDiscoveryTool: No JSON array found in LLM response. Raw:", response);

              return [];

            }

            

            const parsed = JSON.parse(jsonMatch[0]);

      

            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {

              return parsed;

            } else {

              console.warn("OperationNameDiscoveryTool: Parsed JSON is not an array of strings. Parsed:", parsed);

              return [];

            }

          } catch (error) {

            console.error("OperationNameDiscoveryTool: Failed to parse LLM response:", error);

            console.error("Raw response was:", response);

            return [];

          }

        }

      

        async run(input: OperationNameDiscoveryInput): Promise<OperationNameDiscoveryOutput> {

          const {

            repoFiles,

            apiKey,

            model = "ibm/granite-20b-code-instruct",

            projectId,

            baseUrl

          } = input;

      

          try {

            const prompt = this.buildPrompt(repoFiles);

            

            const llm = new WatsonxChatModel(model as any, { apiKey, baseUrl, projectId });

            llm.config({

              parameters: {

                temperature: 0.0, // Be deterministic

                maxTokens: 2048,

              },

            });

      

            const response = await llm.create({ messages: [new UserMessage(prompt)] });

            const rawResponse = response.getTextContent();

            const operations = this.parseLLMResponse(rawResponse);

      

            return {

              success: true,

              operations,

              rawResponse,

            };

      

          } catch (error) {

            return {

              success: false,

              operations: [],

              error: error instanceof Error ? error.message : String(error),

            };

          }

        }

}
