import { GovernanceCanister, Topic, Vote, memoToNeuronAccountIdentifier, ProposalInfo } from "npm:@dfinity/nns";
import { LedgerCanister, AccountIdentifier } from "npm:@dfinity/ledger-icp";
import { Principal } from "npm:@dfinity/principal";
import { bold, cyan, red, green, yellow } from "https://deno.land/std/fmt/colors.ts";
import { GOVERNANCE_ID, SIX_MONTHS_AND_ONE_DAY } from "./types.ts";
import { storeProposal, proposalExists, updateMinimumProposalId, getMinimumProposalId, getUnprocessedProposals, markProposalProcessed } from "./db.ts";
import { toState } from "./utils.ts";

/**
 * Retrieves all proposals and stores them in the database
 * Uses pagination to get all proposals until we reach one we already have
 */
export async function retrieveAndStoreProposals(governance: GovernanceCanister) {
  try {
    let beforeProposal: { id: bigint } | undefined = undefined;
    let continueFetching = true;
    let totalStored = 0;
    let batchCount = 0;
    
    console.log(bold(cyan("\n=== Retrieving and storing proposals ===")));
    
    // Check if we have a minimum proposal ID already
    const minProposalId = getMinimumProposalId();
    if (minProposalId) {
      console.log(`Found existing minimum proposal ID: ${minProposalId}`);
      console.log(`Will only fetch proposals newer than this ID`);
      // No need to set beforeProposal here - we'll fetch newest proposals first
    }
    
    const startTime = Date.now();
    
    while (continueFetching) {
      batchCount++;
      
      // Fetch a batch of proposals
      const response = await governance.listProposals({
        request: {
          limit: 30,
          includeRewardStatus: [],
          beforeProposal: beforeProposal ? beforeProposal.id : undefined,
          excludeTopic: [],
          includeAllManageNeuronProposals: false,
          includeStatus: [],
          omitLargeFields: true
        },
        certified: true
      });
      
      const proposals = response.proposals || [];
      console.log(`Batch ${batchCount}: Retrieved ${proposals.length} proposals`);
      
      if (proposals.length === 0) {
        console.log("No more proposals to retrieve.");
        break;
      }
      
      // Track the minimum proposal ID we've seen
      let batchMinId: bigint | null = null;
      let allExist = true;
      let reachedExistingMinimum = false;
      
      // Process each proposal in the batch
      for (const proposal of proposals) {
        if (!proposal.id) continue;
        const proposalId = proposal.id.toString();
        
        // Check if we've reached our minimum stored proposal ID
        if (minProposalId && BigInt(proposalId) <= BigInt(minProposalId)) {
          console.log(`Reached minimum proposal ID (${minProposalId}). Stopping retrieval.`);
          reachedExistingMinimum = true;
          break;
        }
        
        // Update minimum ID
        if (batchMinId === null || proposal.id < batchMinId) {
          batchMinId = proposal.id;
        }
        
        // Always store the proposal to refresh its data
        const exists = proposalExists(proposalId);
        storeProposal(proposalId, proposal);
        
        if (!exists) {
          allExist = false;
          totalStored++;
        }
      }
      
      // If we've reached the minimum ID, stop fetching
      if (reachedExistingMinimum) {
        continueFetching = false;
        continue;
      }
      
      // Update minimum proposal ID in database if this is our first run
      if (batchMinId !== null && !minProposalId) {
        // Only set the minimum ID from the first batch on first run
        if (batchCount === 1) {
          updateMinimumProposalId(batchMinId.toString());
          console.log(green(`Set minimum proposal ID to ${batchMinId.toString()}`));
        }
      }
      
      // If we have all proposals in this batch, we can stop fetching
      if (allExist && proposals.length > 0) {
        console.log("Reached proposals we already have in the database.");
        continueFetching = false;
      }
      
      // If we have more to fetch, set up pagination for next batch
      if (proposals.length > 0 && continueFetching) {
        // Use the last proposal's ID for pagination
        const lastProposal = proposals[proposals.length - 1];
        if (lastProposal.id) {
          beforeProposal = { id: lastProposal.id };
        } else {
          continueFetching = false;
        }
      } else {
        continueFetching = false;
      }
      
      // Safety check: don't fetch too many batches
      if (batchCount >= 100) {
        console.log(yellow("⚠️ Reached batch limit (100). Stopping retrieval."));
        continueFetching = false;
      }
    }
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(green(bold(`✅ Retrieved and refreshed all proposals. Added ${totalStored} new proposals in ${elapsedSeconds}s`)));
    
  } catch (error) {
    console.error(red(bold(`❌ Error retrieving proposals: ${error instanceof Error ? error.message : String(error)}`)));
  }
}

/**
 * Process stored proposals and vote on eligible ones
 */
export async function processAndVoteOnStoredProposals(governance: GovernanceCanister, neuronId: bigint) {
  console.log(bold(cyan("\n=== Processing stored proposals ===")));
  
  try {
    // Get all unprocessed proposals
    const proposals = getUnprocessedProposals();
    console.log(`Found ${proposals.length} unprocessed proposals`);
    
    if (proposals.length === 0) {
      return;
    }
    
    // Process each proposal
    for (const proposal of proposals) {
      console.log(`Processing proposal ID: ${proposal.id}`);
      
      try {
        // Check if the proposal is still open for voting
        if (proposal.status === 0 && 
            Number(proposal.proposalTimestampSeconds) + 
            Number(proposal.deadlineTimestampSeconds || 0) > Date.now() / 1000) {
          
          console.log(`Proposal ${proposal.id} is still open for voting.`);
          
          // Check if the neuron has already voted
          const voted = proposal.ballots?.some((ballot: any) => 
            ballot.neuronId?.toString() === neuronId.toString());
          
          if (voted) {
            console.log(`Neuron ${neuronId.toString()} has already voted on proposal ${proposal.id}.`);
          } else {
            console.log(`Neuron ${neuronId.toString()} hasn't voted on proposal ${proposal.id}. Casting reject vote...`);
            
            // Cast reject vote
            await governance.registerVote({
              neuronId,
              proposalId: BigInt(proposal.id),
              vote: Vote.No,
            });
            
            console.log(green(`✅ Successfully cast reject vote for proposal ${proposal.id}`));
          }
        } else {
          console.log(`Proposal ${proposal.id} is closed or no longer eligible for voting.`);
        }
      } catch (voteError) {
        console.error(red(`❌ Error voting on proposal ${proposal.id}: ${voteError instanceof Error ? voteError.message : String(voteError)}`));
      }
      
      // Don't mark as processed - keep proposals in database
      // markProposalProcessed(proposal.id);
    }
  } catch (error) {
    console.error(red(bold(`❌ Error processing proposals: ${error instanceof Error ? error.message : String(error)}`)));
  }
}

/**
 * Lists and votes on open proposals
 * This is the main entry point that orchestrates proposal retrieval and voting
 */
export async function listAndVoteOnProposals(governance: GovernanceCanister, neuronId: bigint) {
  try {
    // Step 1: Retrieve and store all new proposals
    await retrieveAndStoreProposals(governance);
    
    // Step 2: Process the stored proposals and vote
    await processAndVoteOnStoredProposals(governance, neuronId);
    
  } catch (error) {
    console.error(red(bold("❌ Error in proposal management:")), error);
  }
}

export async function createNeuron(governance: GovernanceCanister, ledger: LedgerCanister, principal: Principal) {
  console.log("No neuron found for this principal. A new neuron will be staked.");
  console.log(`A dissolve delay of ${Number(SIX_MONTHS_AND_ONE_DAY)/(24*60*60)} days will be set.`);
  
  const confirmStake = confirm("Proceed to stake 1.001 ICP to create a neuron? [y/n]");
  if (!confirmStake) {
    Deno.exit(0);
  }
  
  try {
    const memo = BigInt(Date.now());  // use current timestamp as unique memo
    const destAccount = memoToNeuronAccountIdentifier({
      controller: principal, memo, governanceCanisterId: GOVERNANCE_ID
    });
    
    const amountE8s = BigInt(1_001_00000), feeE8s = BigInt(10_000);
    console.log(bold(cyan("Transferring:")), `${Number(amountE8s) / 100_000_000} ICP (${amountE8s} e8s)`);
    console.log(bold(cyan("Fee:")), `${Number(feeE8s) / 100_000_000} ICP (${feeE8s} e8s)`);
    
    // Check balance first
    try {
      const accountId = AccountIdentifier.fromPrincipal({ principal }).toHex();
      const balance = await ledger.accountBalance({ accountIdentifier: accountId });
      console.log(bold(cyan("Current balance:")), `${Number(balance) / 100_000_000} ICP (${balance} e8s)`);
      
      if (balance < amountE8s + feeE8s) {
        console.error(red(bold(`❌ Insufficient funds: Need ${Number(amountE8s + feeE8s) / 100_000_000} ICP but have ${Number(balance) / 100_000_000} ICP`)));
        Deno.exit(1);
      }
    } catch (balanceError) {
      console.error(red(bold("❌ Error checking balance:")), balanceError);
      Deno.exit(1);
    }
    
    const blockIndex = await ledger.transfer({ to: destAccount, amount: amountE8s, fee: feeE8s, memo });
    console.log(bold(green("ICP sent in block index:")), blockIndex);
    
    const newNeuronId = await governance.claimOrRefreshNeuronFromAccount({ controller: principal, memo });
    if (!newNeuronId) {
      throw new Error("Neuron creation failed. (No neuron ID returned)");
    }
    console.log("Neuron created with ID:", newNeuronId.toString());
    
    // After neuron is created, configure dissolve delay and followees
    try {
      // Default dissolve delay for new neurons is 7 days (604800 seconds)
      const DEFAULT_DISSOLVE_SECONDS = 7 * 24 * 60 * 60;
      
      // Calculate additional seconds needed
      const additionalSeconds = SIX_MONTHS_AND_ONE_DAY + DEFAULT_DISSOLVE_SECONDS;
      
      // Increase the dissolve delay (rather than setting it directly)
      await governance.increaseDissolveDelay({ 
        neuronId: newNeuronId, 
        additionalDissolveDelaySeconds: additionalSeconds
      });
      
      // Follow no one (manual voting) for all topics
      for (const topic of Object.values(Topic).filter(t => typeof t === "number") as number[]) {
        try {
          await governance.setFollowees({ neuronId: newNeuronId, topic, followees: [] });
        } catch (error) {
          // Log the error but continue with other topics
          console.log(yellow(`ℹ️ Skipping topic ${topic}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
      
      const totalDays = SIX_MONTHS_AND_ONE_DAY / (24 * 60 * 60);
      console.log(`Neuron is now configured with a ${totalDays.toFixed(1)} day dissolve delay and no followees.`);
      
      return newNeuronId;
    } catch (error) {
      console.error(red(bold("❌ Error managing neuron:")), error);
      
      // Handle BigInt serialization
      try {
        const safeError = JSON.parse(JSON.stringify(error, (_, value) => 
          typeof value === 'bigint' ? value.toString() + 'n' : value
        ));
        console.error(red("Error details:"), safeError);
      } catch (_jsonError) {
        console.error(red("Error details:"), String(error));
      }
      Deno.exit(1);
    }
  } catch (error) {
    console.error(red(bold("❌ Transfer Error:")), error);
    
    // Handle BigInt serialization
    try {
      const safeError = JSON.parse(JSON.stringify(error, (_, value) => 
        typeof value === 'bigint' ? value.toString() + 'n' : value
      ));
      console.error(red("Error details:"), safeError);
    } catch (_jsonError) {
      console.error(red("Error details:"), String(error));
    }
    Deno.exit(1);
  }
} 