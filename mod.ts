import { bold, red, cyan, green, yellow } from "https://deno.land/std/fmt/colors.ts";
import { createIdentityFromKey, setupAgent } from "./identity.ts";
import { retrieveAndStoreProposals, createNeuron, processAndVoteOnStoredProposals } from "./neuron.ts";
import { startWebServer, PORT } from "./web.ts";
import { runProposalAnalysis, processProposal } from "./agent.ts";
import { getConfigValue, getUnprocessedProposals } from "./db.ts";

// Main entry point for neuronagent package

// Export main functionality
export { analyzeProposal, initModel, processProposal, runProposalAnalysis } from "./agent.ts";
export { startWebServer, PORT } from "./web.ts";
export {
  storeProposal,
  getProposal,
  scheduleVote,
  getConfigValue,
  setConfigValue,
  getAgentVotes,
  getAgentVote,
  getAgentLogs,
  resetAgentData
} from "./db.ts";
export { createIdentityFromKey, setupAgent } from "./identity.ts";

// Add a variable to store the governance instance
let globalGovernance: any = null;
let globalNeuronId: bigint | null = null;

/**
 * Main function to start the Oscillum service
 * 
 * @returns A promise that resolves when the server is started
 */
export async function start() {
  // Initialize the proposal analysis system
  runProposalAnalysis();
  
  // Start the web server
  startWebServer();
  
  // Set up periodic proposal processing
  setupPeriodicProposalProcessing();
  
  console.log(`🚀 Oscillum service running on http://localhost:${PORT}`);
  
 
}

// Set up periodic processing of proposals every minute
function setupPeriodicProposalProcessing() {
  console.log(bold(cyan("\n=== Setting up periodic proposal processing every 1 minute ===")));
  
  const PROPOSAL_PROCESS_INTERVAL = 60 * 1000; // 1 minute
  
  // Define the processing function to avoid code duplication
  const processProposals = async () => {
    try {
      // Pass the neuronId to filter eligible proposals
      const proposals = getUnprocessedProposals(globalNeuronId);
      
      if (proposals.length > 0) {
        console.log(bold(cyan(`\n=== Processing ${proposals.length} unprocessed proposals at ${new Date().toISOString()} ===`)));
        
        // Process proposals with AI
        for (const proposal of proposals) {
          await processProposal(proposal);
        }
        
        // If we have governance set up, also try to vote on proposals
        if (globalGovernance && globalNeuronId) {
          await processAndVoteOnStoredProposals(globalGovernance, globalNeuronId);
        }
      }
    } catch (error) {
      console.error(red(bold(`❌ Error in periodic proposal processing: ${error instanceof Error ? error.message : String(error)}`)));
    }
  };
  
  // Run the first processing after 20 seconds
  console.log(yellow("⏱️ First proposal processing will run in 20 seconds"));
  setTimeout(processProposals, 20 * 1000);
  
  // Then continue with the regular interval
  setInterval(processProposals, PROPOSAL_PROCESS_INTERVAL);
  
  console.log(green("✅ Periodic proposal processing configured"));
}

// If this module is executed directly (not imported), start the service
if (import.meta.main) {
  await runICPFunctionality();
  await start();
}

// Original ICP functionality
async function runICPFunctionality() {
  // 1. Get or create identity from config stored in SQLite
  const IC_AUTHENTICATION_KEY = getConfigValue("IC_AUTHENTICATION_KEY") || "";
  const identity = await createIdentityFromKey(IC_AUTHENTICATION_KEY);

  const principal = identity.getPrincipal();
  console.log(bold("Using principal:") + " " + red(principal.toText()));

  // Retrieve user preferences from the database (which now has the default set by ensureConfigDefaults)
  let USER_PROMPT = getConfigValue("USER_PROMPT");
  console.log(bold("User preferences:"), USER_PROMPT);

  // 2. Setup agent and canisters
  const { governance, ledger } = await setupAgent(identity);
  
  // Store governance for later use
  globalGovernance = governance;

  // 3. Check for existing neuron
  const neurons = await governance.listNeurons({ certified: true });
  if (neurons.length > 0) {
    // Just use the first neuron if multiple exist
    const neuron = neurons[0];
    globalNeuronId = neuron.neuronId;
    console.log("Using neuron ID:", neuron.neuronId.toString());
    
    // Check for open proposals to fetch
    console.log(bold("\n=== Checking for proposals to retrieve and store ==="));
    
    // Initial run to collect proposals only (no voting)
    await retrieveAndStoreProposals(governance);
    
    const PROPOSAL_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
    
    console.log(bold(cyan(`\n=== Setting up periodic proposal retrieval every 30 minutes ===`)));
    
    setInterval(async () => {
      try {
        console.log(bold(cyan(`\n=== Periodic proposal retrieval triggered at ${new Date().toISOString()} ===`)));
        await retrieveAndStoreProposals(governance);
      } catch (error) {
        console.error(red(bold(`❌ Error in periodic proposal retrieval: ${error instanceof Error ? error.message : String(error)}`)));
      }
    }, PROPOSAL_CHECK_INTERVAL);
    
  } else {
    // Create a new neuron with proper settings
    const neuronId = await createNeuron(governance, ledger, principal);
    if (neuronId) {
      globalNeuronId = neuronId;
    }
  }
}

