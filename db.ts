import { join } from "https://deno.land/std/path/mod.ts";
import { bold, red, yellow } from "https://deno.land/std/fmt/colors.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts"; // WASM-based SQLite
import { generateRandomSecret } from "./utils.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { toState } from "./utils.ts";

const currentDir = Deno.cwd();
const DB_PATH = join(currentDir, "oscillum.db");

/**
 * Ensures that default configuration values are set in the database
 * @param db The database connection
 */
function ensureConfigDefaults(db: DB): void {
  try {
    // For each default config key, check if it exists and set it if it doesn't
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      // Skip if null or undefined
      if (value === null || value === undefined) continue;
      
      // Check if this config key already exists
      let exists = false;
      for (const _ of db.query("SELECT 1 FROM config WHERE key = ?", [key])) {
        exists = true;
        break;
      }
      
      // Only insert if it doesn't exist
      if (!exists) {
        console.log(yellow(bold(`Setting default configuration for ${key}`)));
        db.query(
          "INSERT INTO config (key, value) VALUES (?, ?)",
          [key, String(value)]
        );
      }
    }
  } catch (error) {
    console.error(red(bold(`❌ Error setting default configuration: ${error instanceof Error ? error.message : String(error)}`)));
  }
}

function ensureDB(): DB {
  const db = new DB(DB_PATH);
  
  db.execute(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      processed INTEGER DEFAULT 0
    )
  `);

  // Scheduled votes table with added error tracking
  db.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id TEXT NOT NULL,
      vote_type TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      executed INTEGER DEFAULT 0,
      executed_time INTEGER,
      error_message TEXT,
      error_details TEXT,
      UNIQUE(proposal_id)
    )
  `);
  
  // Check if we need to add new columns for error tracking
  try {
    // Check if executed_time column exists
    let hasExecutedTime = false;
    for (const _ of db.query("PRAGMA table_info(scheduled_votes)")) {
      if (_[1] === "executed_time") {
        hasExecutedTime = true;
        break;
      }
    }
    
    // Add executed_time column if it doesn't exist
    if (!hasExecutedTime) {
      db.execute("ALTER TABLE scheduled_votes ADD COLUMN executed_time INTEGER");
    }
    
    // Check if error_message column exists
    let hasErrorMessage = false;
    for (const _ of db.query("PRAGMA table_info(scheduled_votes)")) {
      if (_[1] === "error_message") {
        hasErrorMessage = true;
        break;
      }
    }
    
    // Add error_message column if it doesn't exist
    if (!hasErrorMessage) {
      db.execute("ALTER TABLE scheduled_votes ADD COLUMN error_message TEXT");
    }
    
    // Check if error_details column exists
    let hasErrorDetails = false;
    for (const _ of db.query("PRAGMA table_info(scheduled_votes)")) {
      if (_[1] === "error_details") {
        hasErrorDetails = true;
        break;
      }
    }
    
    // Add error_details column if it doesn't exist
    if (!hasErrorDetails) {
      db.execute("ALTER TABLE scheduled_votes ADD COLUMN error_details TEXT");
    }
  } catch (error) {
    console.error(red(bold(`❌ Error updating scheduled_votes table schema: ${error instanceof Error ? error.message : String(error)}`)));
  }

  // New table for AI agent votes
  db.execute(`
    CREATE TABLE IF NOT EXISTS agent_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id TEXT NOT NULL,
      vote_type TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      scheduled BOOLEAN DEFAULT FALSE,
      UNIQUE(proposal_id)
    )
  `);
  
  // New table for agent logs (communication with OpenAI)
  db.execute(`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id TEXT NOT NULL,
      request TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Ensure default configuration is set
  ensureConfigDefaults(db);

  return db;
}

export function getConfigValue(key: string): string | undefined {
  const db = ensureDB();
  try {
    for (const [value] of db.query("SELECT value FROM config WHERE key = ?", [key])) {
      return String(value);
    }
    return undefined;
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving config: ${error instanceof Error ? error.message : String(error)}`)));
    return undefined;
  } finally {
    db.close();
  }
}

export function setConfigValue(key: string, value: string): void {
  const db = ensureDB();
  try {
    db.query(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  } catch (error) {
    console.error(red(bold(`❌ Error setting config: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
}


export function updateConfig(key: string, value: string): void {
  try {
    setConfigValue(key, value);
  } catch (error) {
    console.error(red(bold(`❌ Error updating config: ${error instanceof Error ? error.message : String(error)}`)));
  }
}

/**
 * Stores a proposal in the database
 */
export function storeProposal(id: string, data: unknown): void {
  const db = ensureDB();
  try {
    // Use the toState function to safely serialize the proposal data
    const serializedData = JSON.stringify(toState(data));
    
    db.query(
      `INSERT INTO proposals (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      [id, serializedData],
    );
  } catch (error) {
    console.error(red(bold(`❌ Error storing proposal: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
}

/**
 * Gets a proposal from the database by ID
 */
export function getProposal(id: string): any | undefined {
  const db = ensureDB();
  try {
    for (const [data] of db.query("SELECT data FROM proposals WHERE id = ?", [id])) {
      return JSON.parse(String(data));
    }
    return undefined;
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving proposal: ${error instanceof Error ? error.message : String(error)}`)));
    return undefined;
  } finally {
    db.close();
  }
}

/**
 * Checks if a proposal exists in the database
 */
export function proposalExists(id: string): boolean {
  const db = ensureDB();
  try {
    for (const [count] of db.query("SELECT COUNT(*) FROM proposals WHERE id = ?", [id])) {
      return Number(count) > 0;
    }
    return false;
  } catch (error) {
    console.error(red(bold(`❌ Error checking proposal existence: ${error instanceof Error ? error.message : String(error)}`)));
    return false;
  } finally {
    db.close();
  }
}

/**
 * Gets or sets the minimum proposal ID we've encountered
 */
export function getMinimumProposalId(): string | undefined {
  return getConfigValue("minimum_proposal_id");
}

/**
 * Sets the minimum proposal ID if it doesn't exist or is greater than the current value
 */
export function updateMinimumProposalId(proposalId: string): void {
  const currentMin = getMinimumProposalId();
  
  // If no minimum exists or the new ID is lower, update it
  if (!currentMin || BigInt(proposalId) < BigInt(currentMin)) {
    setConfigValue("minimum_proposal_id", proposalId);
  }
}

/**
 * Gets unprocessed proposals from the database
 */
export function getUnprocessedProposals(): any[] {
  const db = ensureDB();
  const proposals: any[] = [];
  
  try {
    for (const [id, data] of db.query("SELECT id, data FROM proposals WHERE processed = 0")) {
      try {
        proposals.push({
          id: String(id),
          ...JSON.parse(String(data))
        });
      } catch (parseError) {
        console.error(red(bold(`❌ Error parsing proposal data: ${parseError instanceof Error ? parseError.message : String(parseError)}`)));
      }
    }
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving unprocessed proposals: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
  
  return proposals;
}

/**
 * Marks a proposal as processed
 */
export function markProposalProcessed(id: string): void {
  const db = ensureDB();
  try {
    db.query("UPDATE proposals SET processed = 1 WHERE id = ?", [id]);
  } catch (error) {
    console.error(red(bold(`❌ Error marking proposal as processed: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
}

/**
 * Schedules a vote to be executed in the future
 * @param proposalId The proposal ID to vote on
 * @param voteType "yes" or "no"
 * @param delaySeconds Number of seconds to delay vote (default 3600 - 1 hour)
 * @returns The ID of the scheduled vote
 */
export function scheduleVote(proposalId: string, voteType: string, delaySeconds: number = 3600): number {
  // Ensure the proposal exists in the database even if just as a placeholder
  ensureProposalExists(proposalId);
  
  const db = ensureDB();
  try {
    // Calculate the execution time
    const scheduledTime = Math.floor(Date.now() / 1000) + delaySeconds;
    
    // Delete any existing scheduled votes for this proposal
    db.query("DELETE FROM scheduled_votes WHERE proposal_id = ?", [proposalId]);
    
    // Insert the new scheduled vote
    db.query(
      "INSERT INTO scheduled_votes (proposal_id, vote_type, scheduled_time) VALUES (?, ?, ?)",
      [proposalId, voteType, scheduledTime]
    );
    
    // Get the inserted ID
    return db.lastInsertRowId;
  } catch (error) {
    console.error(red(bold(`❌ Error scheduling vote: ${error instanceof Error ? error.message : String(error)}`)));
    return 0;
  } finally {
    db.close();
  }
}

/**
 * Gets the scheduled vote for a proposal
 * @param proposalId The proposal ID
 * @returns Scheduled vote details or undefined
 */
export function getScheduledVote(proposalId: string): { id: number, voteType: string, scheduledTime: number } | undefined {
  // Ensure the proposal exists in the database even if just as a placeholder
  ensureProposalExists(proposalId);
  
  const db = ensureDB();
  try {
    for (const [id, voteType, scheduledTime] of db.query(
      "SELECT id, vote_type, scheduled_time FROM scheduled_votes WHERE proposal_id = ? AND executed = 0", 
      [proposalId]
    )) {
      return {
        id: Number(id),
        voteType: String(voteType),
        scheduledTime: Number(scheduledTime)
      };
    }
    return undefined;
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving scheduled vote: ${error instanceof Error ? error.message : String(error)}`)));
    return undefined;
  } finally {
    db.close();
  }
}

/**
 * Cancels a scheduled vote
 * @param proposalId The proposal ID
 * @returns true if successful
 */
export function cancelScheduledVote(proposalId: string): boolean {
  const db = ensureDB();
  try {
    db.query("DELETE FROM scheduled_votes WHERE proposal_id = ?", [proposalId]);
    return true;
  } catch (error) {
    console.error(red(bold(`❌ Error canceling scheduled vote: ${error instanceof Error ? error.message : String(error)}`)));
    return false;
  } finally {
    db.close();
  }
}

/**
 * Gets all pending votes that are due for execution
 * @returns Array of scheduled votes ready to be executed
 */
export function getPendingVotes(): { id: number, proposalId: string, voteType: string }[] {
  const db = ensureDB();
  const pendingVotes: { id: number, proposalId: string, voteType: string }[] = [];
  
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    for (const [id, proposalId, voteType] of db.query(
      "SELECT id, proposal_id, vote_type FROM scheduled_votes WHERE scheduled_time <= ? AND executed = 0", 
      [currentTime]
    )) {
      pendingVotes.push({
        id: Number(id),
        proposalId: String(proposalId),
        voteType: String(voteType)
      });
    }
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving pending votes: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
  
  return pendingVotes;
}

/**
 * Marks a scheduled vote as executed
 * @param id The ID of the scheduled vote
 */
export function markVoteExecuted(id: number): void {
  const db = ensureDB();
  try {
    const executedTime = Math.floor(Date.now() / 1000);
    db.query("UPDATE scheduled_votes SET executed = 1, executed_time = ? WHERE id = ?", [executedTime, id]);
  } catch (error) {
    console.error(red(bold(`❌ Error marking vote as executed: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
}

/**
 * Records an error that occurred during vote execution
 * @param id The ID of the scheduled vote
 * @param errorMessage Brief error message
 * @param errorDetails Detailed error information (optional)
 */
export function recordVoteError(id: number, errorMessage: string, errorDetails?: string): void {
  const db = ensureDB();
  try {
    const executedTime = Math.floor(Date.now() / 1000);
    db.query(
      "UPDATE scheduled_votes SET executed = 1, executed_time = ?, error_message = ?, error_details = ? WHERE id = ?",
      [executedTime, errorMessage, errorDetails || null, id]
    );
  } catch (error) {
    console.error(red(bold(`❌ Error recording vote error: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
}

// Get proposals that have not been analyzed by the agent
export function getUnanalyzedProposals(limit: number = 1, neuronId?: string): any[] {
  const db = ensureDB();
  const proposals: any[] = [];
  
  try {
    const query = `
      SELECT p.id, p.data FROM proposals p
      LEFT JOIN agent_votes av ON p.id = av.proposal_id
      WHERE av.id IS NULL
      ORDER BY CAST(p.id as INTEGER) DESC
      LIMIT ?
    `;
    
    for (const [id, data] of db.query(query, [limit])) {
      try {
        const proposal = {
          id: String(id),
          ...JSON.parse(String(data))
        };
        
        // If neuronId is provided, check if the neuron is eligible to vote
        if (neuronId) {
          let isEligible = false;
          
          // Check ballots in object format
          if (proposal.ballots && typeof proposal.ballots === 'object' && !Array.isArray(proposal.ballots)) {
            if (proposal.ballots[neuronId]) {
              isEligible = true;
            }
          }
          
          // Check ballots in array format
          if (Array.isArray(proposal.ballots)) {
            for (const ballot of proposal.ballots) {
              if (ballot.neuronId?.toString() === neuronId) {
                isEligible = true;
                break;
              }
            }
          }
          
          // Only add eligible proposals when filtering by neuronId
          if (isEligible) {
            proposals.push(proposal);
          }
        } else {
          // If no neuronId filtering, add all proposals
          proposals.push(proposal);
        }
      } catch (parseError) {
        console.error(red(bold(`❌ Error parsing proposal data: ${parseError instanceof Error ? parseError.message : String(parseError)}`)));
      }
    }
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving unanalyzed proposals: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
  
  return proposals;
}

// Store agent vote decision
export function storeAgentVote(proposalId: string, voteType: string, reasoning: string): number {
  const db = ensureDB();
  try {
    const createdAt = Math.floor(Date.now() / 1000);
    
    // Delete any existing agent vote for this proposal
    db.query("DELETE FROM agent_votes WHERE proposal_id = ?", [proposalId]);
    
    // Insert the new agent vote
    db.query(
      "INSERT INTO agent_votes (proposal_id, vote_type, reasoning, created_at) VALUES (?, ?, ?, ?)",
      [proposalId, voteType, reasoning, createdAt]
    );
    
    // Get the inserted ID
    return db.lastInsertRowId;
  } catch (error) {
    console.error(red(bold(`❌ Error storing agent vote: ${error instanceof Error ? error.message : String(error)}`)));
    return 0;
  } finally {
    db.close();
  }
}

// Update agent vote to mark it as scheduled
export function markAgentVoteScheduled(proposalId: string): boolean {
  const db = ensureDB();
  try {
    db.query("UPDATE agent_votes SET scheduled = TRUE WHERE proposal_id = ?", [proposalId]);
    return true;
  } catch (error) {
    console.error(red(bold(`❌ Error marking agent vote as scheduled: ${error instanceof Error ? error.message : String(error)}`)));
    return false;
  } finally {
    db.close();
  }
}

// Log agent communication with OpenAI
export function logAgentCommunication(proposalId: string, request: string, response: string): number {
  const db = ensureDB();
  try {
    const createdAt = Math.floor(Date.now() / 1000);
    
    // Insert the log entry
    db.query(
      "INSERT INTO agent_logs (proposal_id, request, response, created_at) VALUES (?, ?, ?, ?)",
      [proposalId, request, response, createdAt]
    );
    
    // Get the inserted ID
    return db.lastInsertRowId;
  } catch (error) {
    console.error(red(bold(`❌ Error logging agent communication: ${error instanceof Error ? error.message : String(error)}`)));
    return 0;
  } finally {
    db.close();
  }
}

// Get agent votes
export function getAgentVotes(limit: number = 100, offset: number = 0): any[] {
  const db = ensureDB();
  const votes: any[] = [];
  
  try {
    for (const [id, proposalId, voteType, reasoning, createdAt, scheduled] of db.query(
      "SELECT id, proposal_id, vote_type, reasoning, created_at, scheduled FROM agent_votes ORDER BY created_at DESC LIMIT ? OFFSET ?", 
      [limit, offset]
    )) {
      votes.push({
        id: Number(id),
        proposalId: String(proposalId),
        voteType: String(voteType),
        reasoning: String(reasoning),
        createdAt: Number(createdAt),
        scheduled: Boolean(scheduled)
      });
    }
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving agent votes: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
  
  return votes;
}

// Get agent logs for a specific proposal
export function getAgentLogs(proposalId: string): any[] {
  const db = ensureDB();
  const logs: any[] = [];
  
  try {
    for (const [id, request, response, createdAt] of db.query(
      "SELECT id, request, response, created_at FROM agent_logs WHERE proposal_id = ? ORDER BY created_at ASC", 
      [proposalId]
    )) {
      logs.push({
        id: Number(id),
        request: String(request),
        response: String(response),
        createdAt: Number(createdAt)
      });
    }
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving agent logs: ${error instanceof Error ? error.message : String(error)}`)));
  } finally {
    db.close();
  }
  
  return logs;
}

// Get agent vote for a specific proposal
export function getAgentVote(proposalId: string): any | undefined {
  const db = ensureDB();
  try {
    for (const [id, voteType, reasoning, createdAt, scheduled] of db.query(
      "SELECT id, vote_type, reasoning, created_at, scheduled FROM agent_votes WHERE proposal_id = ?", 
      [proposalId]
    )) {
      return {
        id: Number(id),
        proposalId: proposalId,
        voteType: String(voteType),
        reasoning: String(reasoning),
        createdAt: Number(createdAt),
        scheduled: Boolean(scheduled)
      };
    }
    return undefined;
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving agent vote: ${error instanceof Error ? error.message : String(error)}`)));
    return undefined;
  } finally {
    db.close();
  }
}

// Reset all agent data (votes and logs) for a specific proposal
export function resetAgentData(proposalId: string): boolean {
  const db = ensureDB();
  try {
    // Begin a transaction to ensure all operations succeed or fail together
    db.query("BEGIN TRANSACTION");
    
    // Delete agent votes for this proposal
    db.query("DELETE FROM agent_votes WHERE proposal_id = ?", [proposalId]);
    
    // Delete agent logs for this proposal
    db.query("DELETE FROM agent_logs WHERE proposal_id = ?", [proposalId]);
    
    // Commit the transaction
    db.query("COMMIT");
    
    return true;
  } catch (error) {
    // Rollback on error
    db.query("ROLLBACK");
    console.error(red(bold(`❌ Error resetting agent data: ${error instanceof Error ? error.message : String(error)}`)));
    return false;
  } finally {
    db.close();
  }
}

export function getDB() {
  // Return a new database connection
  return ensureDB();
}

/**
 * Ensures that a proposal exists in the database
 * If it doesn't exist, creates a minimal placeholder entry
 * @param id The proposal ID to check/create
 * @returns true if exists/created successfully, false otherwise
 */
export function ensureProposalExists(id: string): boolean {
  if (proposalExists(id)) {
    return true; // Already exists
  }
  
  // Proposal doesn't exist, create a placeholder
  const db = ensureDB();
  try {
    const placeholderData = {
      id: id,
      placeholder: true,
      status: 0, // Unknown status
      topic: 0, // Unspecified topic
      proposalTimestampSeconds: Math.floor(Date.now() / 1000),
      proposal: {
        title: `Proposal ${id} (Placeholder)`,
        summary: "This is a placeholder entry for a proposal that was referenced but couldn't be fetched from the IC."
      }
    };
    
    const serializedData = JSON.stringify(placeholderData);
    
    db.query(
      `INSERT INTO proposals (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      [id, serializedData],
    );
    
    console.log(yellow(bold(`⚠️ Created placeholder for proposal ${id} to prevent data loss`)));
    return true;
  } catch (error) {
    console.error(red(bold(`❌ Error creating proposal placeholder: ${error instanceof Error ? error.message : String(error)}`)));
    return false;
  } finally {
    db.close();
  }
}


