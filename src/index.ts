import "dotenv/config";
import { createWatsonxChatLLM } from "./config/llm.js";
import { MasterOrchestratorAgent } from "./agents/masterOrchestrator.js";
import { FLOW_CONFIG_PATH } from "./config/paths.js";

/**
 * Entry point principal del sistema multi-agente
 */
async function main() {
  console.log("Microservice Modernization Assistant - Master Orchestrator\n");

  try {
    // Validar variables de entorno
    if (!process.env.WATSONX_API_KEY) {
      console.error("❌ Error: WATSONX_API_KEY is not set in your .env file");
      process.exit(1);
    }
    if (!process.env.WATSONX_PROJECT_ID) {
      console.error("❌ Error: WATSONX_PROJECT_ID is not set in your .env file");
      process.exit(1);
    }

    // Crear LLM (WatsonX)
    console.log("🤖 Initializing IBM WatsonX...");
    const llm = createWatsonxChatLLM();
    console.log(
      `✓ WatsonX initialized: ${process.env.WATSONX_CHAT_MODEL || "ibm/granite-3-3-8b-instruct"}\n`,
    );

    // Usar siempre el Master Orchestrator
    console.log("🧠 Using Master Orchestrator Agent...\n");

    const masterOrchestrator = new MasterOrchestratorAgent(llm, {
      configPath: FLOW_CONFIG_PATH,
      enableIntelligentValidation: true,
    });

    const report = await masterOrchestrator.execute();

    if (!report.summary.success) {
      console.error(
        `\n⚠️  Master Orchestrator finished with ${report.summary.failedSteps} of ${report.summary.totalSteps} steps failed`,
      );
      process.exit(1);
    }

    console.log(
      `\n✅ All ${report.summary.successfulSteps} steps completed successfully`,
    );

    console.log("\n✨ Done!\n");
  } catch (error) {
    console.error("\n❌ Fatal error:");
    console.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Ejecutar
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
