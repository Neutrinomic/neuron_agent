import express, { Request, Response } from "npm:express@4.18.2";
import { join } from "https://deno.land/std/path/mod.ts";
import { createIdentityFromKey, setupAgent } from "./identity.ts";
import { getProposal, proposalExists, getUnprocessedProposals, markProposalProcessed, getDB, storeProposal, 
  scheduleVote, getScheduledVote, cancelScheduledVote, getPendingVotes, markVoteExecuted, getConfigValue, setConfigValue,
  getAgentVote, getAgentVotes, getAgentLogs, resetAgentData, storeAgentVote, markAgentVoteScheduled, recordVoteError,
  ensureProposalExists } from "./db.ts";
import { bold, red, green, yellow, cyan } from "https://deno.land/std/fmt/colors.ts";
import { SIX_MONTHS_AND_ONE_DAY } from "./types.ts";
import { analyzeProposal } from "./agent.ts";

// Server configuration
const PORT = 3014;

// Seven months in seconds for minimum dissolve delay
const SEVEN_MONTHS_SECONDS = 7 * 30 * 24 * 60 * 60; // approximately 7 months

// Proposal refresh configuration
const PROPOSAL_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
const LATEST_PROPOSALS_COUNT = 30;

// Vote processing interval (check every 10 seconds)
const VOTE_PROCESSING_INTERVAL = 10 * 1000;

// Modified to use the getDB function
function ensureDB() {
  return getDB();
}

// Process scheduled votes that are ready to be executed
async function processScheduledVotes() {
  try {
    const pendingVotes = getPendingVotes();
    
    if (pendingVotes.length === 0) {
      return; // No pending votes to process
    }
    
    console.log(cyan(`Processing ${pendingVotes.length} pending votes...`));
    
    // Get identity and set up governance
    
    const IC_AUTHENTICATION_KEY = getConfigValue("IC_AUTHENTICATION_KEY");
    if (!IC_AUTHENTICATION_KEY) {
      console.error(red("No IC authentication key found in config."));
      return;
    }
    
    const identity = await createIdentityFromKey(IC_AUTHENTICATION_KEY);
    const { governance } = await setupAgent(identity);  
    
    // Get neurons
    const neurons = await governance.listNeurons({ certified: true });
    if (neurons.length === 0) {
      console.error(red("No neurons found, cannot execute votes."));
      return;
    }
    
    // Use the first neuron
    const neuron = neurons[0];
    
    // Process each pending vote
    for (const vote of pendingVotes) {
      try {
        // Ensure the proposal exists in the database before attempting to vote
        // This guarantees we'll have at least a placeholder entry even if the vote fails
        ensureProposalExists(vote.proposalId);
        
        console.log(cyan(`Executing vote ${vote.voteType} on proposal ${vote.proposalId}...`));
        
        // Cast vote - FIXED: "no" votes should use ID 2, not 0
        await governance.registerVote({
          neuronId: neuron.neuronId,
          proposalId: BigInt(vote.proposalId),
          vote: vote.voteType === "yes" ? 1 : 2, // 1 for yes, 2 for no
        });
        
        // Mark the vote as executed
        markVoteExecuted(vote.id);
        
        // Refresh the proposal to get updated ballot information
        const response = await governance.getProposal({
          proposalId: BigInt(vote.proposalId)
        });
        
        if (response && response.proposal) {
          // Update the proposal in the database
          storeProposal(vote.proposalId, response.proposal);
        }
        
        console.log(green(`✅ Successfully executed ${vote.voteType} vote on proposal ${vote.proposalId}`));
      } catch (error) {
        console.error(red(`❌ Error executing vote on proposal ${vote.proposalId}:`));
        
        // Enhanced error logging - display comprehensive error information
        console.error(red("Error details:"));
        
        // Capture error message and details for database
        let errorMessage = "Unknown error";
        let errorDetails = "";
        
        // Log the basic error message
        if (error instanceof Error) {
          errorMessage = error.message;
          errorDetails = error.stack || "";
          console.error(red(`- Message: ${error.message}`));
          console.error(red(`- Stack: ${error.stack}`));
        } else {
          errorMessage = String(error);
          console.error(red(`- Error object: ${String(error)}`));
        }
        
        // Check for IC-specific error properties
        if (error && typeof error === 'object') {
          try {
            // Prepare detailed error information
            const detailsObj = {};
            
            if ('code' in error) {
              console.error(red(`- Error code: ${error.code}`));
              detailsObj.code = error.code;
            }
            
            if ('detail' in error) {
              console.error(red(`- Error detail: ${JSON.stringify(error.detail, null, 2)}`));
              detailsObj.detail = error.detail;
            }
            
            // Log all properties of the error for completeness
            console.error(red("- All error properties:"));
            for (const key in error) {
              try {
                const value = error[key];
                const strValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                console.error(red(`  ${key}: ${strValue}`));
                
                if (key !== 'stack') {
                  detailsObj[key] = value;
                }
              } catch (e) {
                console.error(red(`  ${key}: [Error stringifying property]`));
              }
            }
            
            // Update error details JSON
            errorDetails = JSON.stringify(detailsObj, null, 2);
          } catch (jsonError) {
            console.error(red(`Error stringifying error details: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`));
          }
        }
        
        // Record vote error in the database
        recordVoteError(vote.id, errorMessage, errorDetails);
        
        // Even if vote fails, try to fetch and store the proposal to ensure it's not lost
        try {
          console.log(yellow(`Attempting to refresh proposal ${vote.proposalId} data after vote error...`));
          const proposal = await governance.getProposal({
            proposalId: BigInt(vote.proposalId)
          });
          
          if (proposal && proposal.proposal) {
            // Check proposal status
            const status = proposal.proposal.status || 0;
            const statusText = ['Unknown', 'Open', 'Rejected', 'Adopted', 'Executed', 'Failed'][status] || 'Unknown';
            console.log(yellow(`Proposal status: ${statusText} (${status})`));
            
            // Ensure the proposal is stored in the database regardless of vote outcome
            storeProposal(vote.proposalId, proposal.proposal);
            console.log(green(`✅ Successfully refreshed proposal ${vote.proposalId} data after error`));
          } else {
            console.error(red(`❌ Failed to refresh proposal ${vote.proposalId} data: No proposal data returned`));
            
            // Ensure we still have at least a placeholder entry in the database
            ensureProposalExists(vote.proposalId);
          }
        } catch (refreshError) {
          console.error(red(`❌ Failed to refresh proposal ${vote.proposalId} data: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`));
          
          // Ensure we still have at least a placeholder entry in the database
          ensureProposalExists(vote.proposalId);
        }
      }
    }
  } catch (error) {
    console.error(red(`❌ Error processing scheduled votes: ${error instanceof Error ? error.message : String(error)}`));
  }
}

// Fetch and store the latest proposals
async function refreshLatestProposals() {
  console.log(bold(cyan("Refreshing latest proposals...")));
  
  try {
    
    const IC_AUTHENTICATION_KEY = getConfigValue("IC_AUTHENTICATION_KEY");
    const identity = await createIdentityFromKey(IC_AUTHENTICATION_KEY);
    const { governance } = await setupAgent(identity);
    
    // Fetch the latest proposals
    const response = await governance.listProposals({
      request: {
        limit: LATEST_PROPOSALS_COUNT,
        includeRewardStatus: [],
        beforeProposal: undefined, // Start with the most recent
        excludeTopic: [],
        includeAllManageNeuronProposals: false,
        includeStatus: [],
        omitLargeFields: false // Include all fields
      },
      certified: true
    });
    
    const proposals = response.proposals || [];
    console.log(`Retrieved ${proposals.length} latest proposals`);
    
    // Store each proposal in the database
    let newProposals = 0;
    for (const proposal of proposals) {
      if (!proposal.id) continue;
      const proposalId = proposal.id.toString();
      
      // Check if the proposal already exists
      const exists = proposalExists(proposalId);
      if (!exists) {
        storeProposal(proposalId, proposal);
        newProposals++;
      }
    }
    
    console.log(green(`✅ Stored ${newProposals} new proposals in the database`));
  } catch (error) {
    console.error(red(`❌ Error refreshing proposals: ${error instanceof Error ? error.message : String(error)}`));
  }
}

// Check and increase neuron dissolve delay if needed
async function ensureMinimumDissolveDelay() {
  console.log(bold("Checking neuron dissolve delay..."));
  
  try {
    const IC_AUTHENTICATION_KEY = getConfigValue("IC_AUTHENTICATION_KEY");
    const identity = await createIdentityFromKey(IC_AUTHENTICATION_KEY);
    const { governance } = await setupAgent(identity);
    
    // Get the user's neurons
    const neurons = await governance.listNeurons({ certified: true });
    
    if (neurons.length === 0) {
      console.log(yellow("No neurons found for this identity."));
      return;
    }
    
    // Process each neuron (although we expect just one)
    for (const neuron of neurons) {
      const neuronId = neuron.neuronId;
      const currentDissolve = Number(neuron.dissolveDelaySeconds || 0);
      
      console.log(`Neuron ${neuronId.toString()} has a dissolve delay of ${(currentDissolve / (24 * 60 * 60)).toFixed(1)} days`);
      
      // Check if the dissolve delay is less than our minimum (7 months)
      if (currentDissolve < SEVEN_MONTHS_SECONDS) {
        const additionalSeconds = SEVEN_MONTHS_SECONDS - currentDissolve;
        
        console.log(`Increasing dissolve delay by ${(additionalSeconds / (24 * 60 * 60)).toFixed(1)} days to reach 7 months...`);
        
        // Increase the dissolve delay
        await governance.increaseDissolveDelay({
          neuronId,
          additionalDissolveDelaySeconds: BigInt(additionalSeconds)
        });
        
        console.log(green(`✅ Successfully increased dissolve delay for neuron ${neuronId.toString()} to 7 months`));
      } else {
        console.log(green(`✅ Neuron ${neuronId.toString()} already has sufficient dissolve delay`));
      }
    }
  } catch (error) {
    console.error(red(`❌ Error checking/updating dissolve delay: ${error instanceof Error ? error.message : String(error)}`));
  }
}

// Web server functionality
export async function startWebServer() {
  // Ensure the neuron's dissolve delay is at least 7 months
  await ensureMinimumDissolveDelay();
  
  // Run the initial proposal refresh
  await refreshLatestProposals();
  
  // Set up the periodic proposal refresh
  console.log(bold(cyan(`Setting up periodic proposal refresh every 30 minutes`)));
  setInterval(refreshLatestProposals, PROPOSAL_REFRESH_INTERVAL);
  
  // Set up the vote processing interval
  console.log(bold(cyan(`Setting up vote processing check every 10 seconds`)));
  setInterval(processScheduledVotes, VOTE_PROCESSING_INTERVAL);
  
  const app = express();
  
  // Serve static files from the 'public' directory (built by Vite)
  const currentDir = Deno.cwd();
  const publicPath = join(currentDir, "public");
  
  // Add CORS middleware
  app.use((req: Request, res: Response, next: express.NextFunction) => {
    // Allow requests from any origin during development
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Allow common HTTP methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // Allow common headers
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });
  
  // Configure middleware
  app.use(express.static(publicPath));
  app.use(express.json());
  
  // API endpoints
  app.get("/api/status", async (req: Request, res: Response) => {
    try {
      const IC_AUTHENTICATION_KEY = getConfigValue("IC_AUTHENTICATION_KEY");
      const identity = await createIdentityFromKey(IC_AUTHENTICATION_KEY);
      const principal = identity.getPrincipal();
      
      res.json({
        status: "online",
        principal: principal.toText(),
        userPreference: getConfigValue("USER_PROMPT")
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get proposals with pagination
  app.get("/api/proposals", (req: Request, res: Response) => {
    try {
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string || "all"; // all, processed, unprocessed
      
      const db = ensureDB();
      
      try {
        // Build the query based on status filter
        let query = "SELECT id, data, processed FROM proposals";
        const params: any[] = [];
        
        if (status === "processed") {
          query += " WHERE processed = 1";
        } else if (status === "unprocessed") {
          query += " WHERE processed = 0";
        }
        
        // Add ordering and pagination
        query += " ORDER BY CAST(id as INTEGER) DESC LIMIT ? OFFSET ?";
        params.push(limit, (page - 1) * limit);
        
        // Get total count for pagination info
        let totalQuery = "SELECT COUNT(*) as total FROM proposals";
        if (status === "processed") {
          totalQuery += " WHERE processed = 1";
        } else if (status === "unprocessed") {
          totalQuery += " WHERE processed = 0";
        }
        
        // Execute count query
        let total = 0;
        for (const [count] of db.query(totalQuery)) {
          total = Number(count);
          break;
        }
        
        // Execute main query
        const proposals: any[] = [];
        for (const [id, data, processed] of db.query(query, params)) {
          try {
            const parsedData = JSON.parse(String(data));
            proposals.push({
              id: String(id),
              processed: Boolean(processed),
              ...parsedData
            });
          } catch (parseError) {
            console.error(red(bold(`❌ Error parsing proposal data: ${parseError instanceof Error ? parseError.message : String(parseError)}`)));
          }
        }
        
        // Return with pagination info
        res.json({
          proposals,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } finally {
        db.close();
      }
    } catch (error) {
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get proposal by ID
  app.get("/api/proposals/:id", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      if (!proposalExists(id)) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      const proposal = getProposal(id);
      if (!proposal) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      res.json({
        status: "success",
        proposal: {
          id,
          ...proposal
        }
      });
    } catch (error) {
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Schedule a vote on a specific proposal
  app.post("/api/proposals/:id/schedule-vote", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { vote } = req.body;
      
      if (!proposalExists(id)) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      if (vote !== "yes" && vote !== "no") {
        return res.status(400).json({
          status: "error",
          message: "Invalid vote value. Must be 'yes' or 'no'"
        });
      }
      
      const delaySeconds = req.body.delaySeconds || 3600; // Default 3600 seconds (1 hour)
      const voteId = scheduleVote(id, vote, delaySeconds);
      
      if (voteId) {
        // Get the scheduled time
        const scheduledVote = getScheduledVote(id);
        
        res.json({
          status: "success",
          message: `Vote ${vote} scheduled on proposal ${id}`,
          scheduledVote: scheduledVote
        });
      } else {
        res.status(500).json({
          status: "error",
          message: "Failed to schedule vote"
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Cancel a scheduled vote
  app.post("/api/proposals/:id/cancel-vote", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      // Check if there's a scheduled vote
      const scheduledVote = getScheduledVote(id);
      if (!scheduledVote) {
        return res.status(404).json({
          status: "error",
          message: "No scheduled vote found for this proposal"
        });
      }
      
      // Cancel the vote
      const result = cancelScheduledVote(id);
      
      if (result) {
        res.json({
          status: "success",
          message: `Vote on proposal ${id} has been canceled`
        });
      } else {
        res.status(500).json({
          status: "error",
          message: "Failed to cancel the vote"
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get the status of a scheduled vote
  app.get("/api/proposals/:id/vote-status", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      // Check if there's a scheduled vote
      const scheduledVote = getScheduledVote(id);
      
      res.json({
        status: "success",
        scheduledVote: scheduledVote || null
      });
    } catch (error) {
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Vote on a specific proposal (keep for immediate voting if needed)
  app.post("/api/proposals/:id/vote", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { vote, immediate } = req.body;
      
      // Always ensure the proposal exists before proceeding with any vote action
      // This guarantees we'll have at least a placeholder entry even if checks fail
      ensureProposalExists(id);
      
      if (!proposalExists(id)) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      if (vote !== "yes" && vote !== "no") {
        return res.status(400).json({
          status: "error",
          message: "Invalid vote value. Must be 'yes' or 'no'"
        });
      }
      
      // If immediate is not explicitly true, schedule the vote instead
      if (immediate !== true) {
        const delaySeconds = req.body.delaySeconds || 3600; // Default 3600 seconds (1 hour)
        const voteId = scheduleVote(id, vote, delaySeconds);
        const scheduledVote = getScheduledVote(id);
        
        return res.json({
          status: "success",
          message: `Vote ${vote} scheduled on proposal ${id}`,
          scheduled: true,
          scheduledVote: scheduledVote
        });
      }
      
      // Continue with immediate voting if requested
      // Get identity and set up governance
      const IC_AUTHENTICATION_KEY = getConfigValue("IC_AUTHENTICATION_KEY");
      if (!IC_AUTHENTICATION_KEY) {
        return res.status(500).json({
          status: "error",
          message: "IC authentication key not found in config"
        });
      }
      
      const identity = await createIdentityFromKey(IC_AUTHENTICATION_KEY);
      const { governance } = await setupAgent(identity);
      
      // Get neurons
      const neurons = await governance.listNeurons({ certified: true });
      if (neurons.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "No neurons found for this identity"
        });
      }
      
      // Use the first neuron
      const neuron = neurons[0];
      
      // Cast vote (immediate)
      try {
        await governance.registerVote({
          neuronId: neuron.neuronId,
          proposalId: BigInt(id),
          vote: vote === "yes" ? 1 : 2, // FIXED: 1 for yes, 2 for no (was using 0 for no)
        });
        
        // Refresh the proposal to get updated ballot information
        const response = await governance.getProposal({
          proposalId: BigInt(id)
        });
        
        if (response && response.proposal) {
          // Update the proposal in the database
          storeProposal(id, response.proposal);
        } else {
          // If no response or no proposal data, ensure we still have at least a placeholder
          ensureProposalExists(id);
        }
        
        res.json({
          status: "success",
          message: `Successfully voted ${vote} on proposal ${id}`,
          neuronId: neuron.neuronId.toString(),
          scheduled: false
        });
      } catch (voteError) {
        console.error("Vote error details:", voteError);
        
        // Extract the error message from the error object
        const errorMessage = voteError instanceof Error ? voteError.message : String(voteError);
        const errorDetail = voteError?.detail?.error_message || "";
        
        // Ensure the proposal still exists in the database even if voting failed
        ensureProposalExists(id);
        
        // Try to refresh the proposal data to keep it up-to-date
        try {
          const proposal = await governance.getProposal({
            proposalId: BigInt(id)
          });
          
          if (proposal && proposal.proposal) {
            storeProposal(id, proposal.proposal);
          }
        } catch (refreshError) {
          console.error(`Error refreshing proposal after vote error: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
        }
        
        // Check for specific error types
        if (errorMessage.includes("already voted") || errorDetail.includes("already voted")) {
          return res.status(400).json({
            status: "error",
            message: `Your neuron has already voted on this proposal`
          });
        }
        
        if (errorMessage.includes("not authorized") || errorDetail.includes("not authorized")) {
          return res.status(403).json({
            status: "error",
            message: `Your neuron is not authorized to vote on this proposal. This may be due to insufficient voting power, neuron age, or dissolve delay.`
          });
        }
        
        // For other errors, return a generic message
        return res.status(400).json({
          status: "error",
          message: `Failed to vote: ${errorMessage || errorDetail || "Unknown error"}`
        });
      }
    } catch (error) {
      console.error("Error voting on proposal:", error);
      
      // Ensure the proposal exists even if an unexpected error occurs
      if (req.params.id) {
        ensureProposalExists(req.params.id);
      }
      
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get("/api/neurons", async (req: Request, res: Response) => {
    try {
      const config = getOrCreateConfig();
      const identity = await createIdentityFromKey(config.IC_AUTHENTICATION_KEY);
      const { governance } = await setupAgent(identity);
      
      const neurons = await governance.listNeurons({ certified: true });
      
      res.json({
        neurons: neurons.map(neuron => {
          // Extract basic information that should be available on all neurons
          const neuronInfo = {
            id: neuron.neuronId.toString(),
            // Use optional chaining and nullish coalescing to handle potentially missing properties
            stake: (neuron.cachedNeuronStake || 0).toString(),
            dissolveDelay: (neuron.dissolveDelaySeconds || 0).toString()
          };
          
          // Add additional information if available in your governance API
          // This depends on the actual structure you get from governance.listNeurons()
          
          return neuronInfo;
        }),
        principalId: identity.getPrincipal().toText()
      });
    } catch (error) {
      console.error("Error fetching neurons:", error);
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post("/api/config", (req: Request, res: Response) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ 
          status: "error", 
          message: "Missing key or value" 
        });
      }
      
      // Use setConfigValue directly instead of dynamic import
      setConfigValue(key, value);
      res.json({ status: "success" });
    } catch (error) {
      res.status(500).json({
        status: "error", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get and set neuron ID for the current user
  app.get("/api/user/neuron", (req: Request, res: Response) => {
    try {
      const db = ensureDB();
      
      try {
        // Get the stored neuron ID from the config table
        const neuronId = getConfigValue("user_neuron_id");
        
        if (neuronId) {
          res.json({
            status: "success",
            neuronId: neuronId
          });
        } else {
          res.json({
            status: "not_found",
            neuronId: null
          });
        }
      } finally {
        db.close();
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post("/api/user/neuron", (req: Request, res: Response) => {
    try {
      const { neuronId } = req.body;
      
      if (!neuronId) {
        return res.status(400).json({
          status: "error",
          message: "Missing neuron ID"
        });
      }
      
      // Store the neuron ID in the config table
      setConfigValue("user_neuron_id", neuronId);
      
      res.json({
        status: "success",
        message: "Neuron ID stored successfully"
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // NEW ENDPOINT: Get a specific config value
  app.get("/api/config", (req: Request, res: Response) => {
    try {
      const key = req.query.key as string;
      
      if (!key) {
        return res.status(400).json({
          status: "error",
          message: "Missing key parameter"
        });
      }
      
      const db = ensureDB();
      
      try {
        const value = getConfigValue(key);
        
        if (value !== undefined) {
          res.json({
            status: "success",
            value: value
          });
        } else {
          res.json({
            status: "not_found",
            message: `No configuration found for key: ${key}`
          });
        }
      } finally {
        db.close();
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get agent vote for a specific proposal
  app.get("/api/proposals/:id/agent-vote", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      if (!proposalExists(id)) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      const agentVote = getAgentVote(id);
      
      if (agentVote) {
        res.json({
          status: "success",
          agentVote: agentVote
        });
      } else {
        res.json({
          status: "not_found",
          message: "No agent vote found for this proposal"
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get agent votes (paginated)
  app.get("/api/agent-votes", (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      const votes = getAgentVotes(limit, offset);
      
      res.json({
        status: "success",
        votes: votes,
        pagination: {
          page,
          limit,
          hasMore: votes.length === limit // Simple way to check if there might be more
        }
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get agent logs for a specific proposal
  app.get("/api/proposals/:id/agent-logs", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      if (!proposalExists(id)) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      const logs = getAgentLogs(id);
      
      res.json({
        status: "success",
        logs: logs
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Reset agent analysis for a specific proposal
  app.post("/api/proposals/:id/reset-agent-analysis", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      if (!proposalExists(id)) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      // Reset agent data (votes, logs, scheduled votes)
      resetAgentData(id);
      
      // Cancel any scheduled votes for this proposal
      cancelScheduledVote(id);
      
      res.json({
        status: "success",
        message: `Agent analysis data for proposal ${id} has been reset`
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // This endpoint for manual reevaluation is left unchanged so users can manually trigger analysis for any proposal, 
  // even when not eligible to vote with their neuron.
  app.post("/api/proposals/:id/trigger-analysis", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      // First ensure the proposal exists in the database - prevents data loss
      ensureProposalExists(id);
      
      // Get proposal data
      const proposal = getProposal(id);
      
      if (!proposal) {
        return res.status(404).json({
          status: "error",
          message: "Proposal not found"
        });
      }
      
      // Reset any existing agent data for this proposal
      resetAgentData(id);
      
      // Run the analysis in the background so we can return a response immediately
      setTimeout(async () => {
        try {
          // Analyze the proposal directly using the simplified approach
          console.log(cyan(`Starting analysis for proposal ${id} using OpenAI with function calling`));
          
          // Use the simplified analyzeProposal function
          const result = await analyzeProposal(proposal);
          
          if (result.success && result.voteType && result.reasoning) {
            // Store the agent vote
            storeAgentVote(id, result.voteType, result.reasoning);
            console.log(green(`✅ Analysis completed for proposal ${id}: Vote ${result.voteType.toUpperCase()}`));
            
            // Ensure proposal still exists (may have been deleted during long-running analysis)
            ensureProposalExists(id);
            
            // If vote type is yes or no, schedule the vote
            if (result.voteType === "yes" || result.voteType === "no") {
              // Get the configured delay from the database
              const delaySeconds = parseInt(getConfigValue("VOTE_SCHEDULE_DELAY") || "3600");
              console.log(cyan(`Using vote schedule delay of ${delaySeconds} seconds (${delaySeconds / 60} minutes)`));
              
              // Schedule the vote with the configured delay
              const scheduleId = scheduleVote(id, result.voteType, delaySeconds);
              
              if (scheduleId) {
                console.log(green(`✅ Scheduled ${result.voteType} vote for proposal ${id} (with ${delaySeconds} seconds delay)`));
                // Mark agent vote as scheduled
                markAgentVoteScheduled(id);
              } else {
                console.error(red(`❌ Failed to schedule vote for proposal ${id}`));
                // Even if scheduling fails, ensure proposal exists
                ensureProposalExists(id);
              }
            }
          } else {
            console.error(yellow(`⚠️ Analysis did not produce a clear decision for proposal ${id}`));
            // Ensure the proposal still exists in the database
            ensureProposalExists(id);
          }
        } catch (err) {
          console.error(red(`❌ Error analyzing proposal ${id}: ${err instanceof Error ? err.message : String(err)}`));
          // Ensure the proposal still exists in the database even after an error
          ensureProposalExists(id);
        }
      }, 0);
      
      res.json({
        status: "success",
        message: `Analysis triggered for proposal ${id} using OpenAI with function calling`
      });
    } catch (error) {
      const id = req.params.id;
      if (id) {
        // Ensure the proposal exists even if an error occurs
        ensureProposalExists(id);
      }
      
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get voting history for a specific proposal
  app.get("/api/proposals/:id/vote-history", (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      // Create the database connection
      const db = ensureDB();
      
      try {
        // Ensure the proposal exists even if just as a placeholder
        ensureProposalExists(id);
        
        // Get the proposal data
        const proposal = getProposal(id);
        
        // Get both executed and pending scheduled votes
        const votes = [];
        for (const [voteId, voteType, scheduledTime, executed, executedTime] of db.query(
          `SELECT id, vote_type, scheduled_time, executed, 
            CASE WHEN executed = 1 THEN executed_time ELSE NULL END as executed_time 
           FROM scheduled_votes 
           WHERE proposal_id = ?
           ORDER BY scheduled_time DESC`, 
          [id]
        )) {
          votes.push({
            id: Number(voteId),
            voteType: String(voteType),
            scheduledTime: Number(scheduledTime),
            executed: Boolean(executed),
            executedTime: executedTime ? Number(executedTime) : null,
          });
        }
        
        // Get agent votes for this proposal
        const agentVote = getAgentVote(id);
        
        res.json({
          status: "success",
          proposal: {
            id,
            exists: !!proposal,
            placeholder: proposal?.placeholder || false,
            data: proposal ? {
              status: proposal.status,
              topic: proposal.topic,
              title: proposal.proposal?.title || `Proposal ${id}`,
              summary: proposal.proposal?.summary?.substring(0, 100) + (proposal.proposal?.summary?.length > 100 ? '...' : '') || 'No summary',
            } : null
          },
          voting: {
            scheduledVotes: votes,
            agentVote: agentVote,
          }
        });
      } catch (error) {
        console.error(red(`Error retrieving vote history: ${error instanceof Error ? error.message : String(error)}`));
        res.status(500).json({
          status: "error",
          message: `Error retrieving vote history: ${error instanceof Error ? error.message : "Unknown error"}`
        });
      } finally {
        db.close();
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Catch-all route to return the main index.html for client-side routing
  app.get("*", (req: Request, res: Response) => {
    res.sendFile(join(publicPath, "index.html"));
  });
  
  // Start the server
  app.listen(PORT);
  
  return app;
}

export { PORT }; 