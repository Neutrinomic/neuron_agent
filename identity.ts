import { Ed25519KeyIdentity } from "npm:@dfinity/identity@2.4.1";
import { createAgent } from "npm:@dfinity/utils";
import { GovernanceCanister } from "npm:@dfinity/nns";
import { LedgerCanister } from "npm:@dfinity/ledger-icp";
import { HOST, GOVERNANCE_ID, LEDGER_ID } from "./types.ts";
import { sha256 } from "./utils.ts";

export async function createIdentityFromKey(authKey: string): Promise<Ed25519KeyIdentity> {
  const entropy = await sha256(authKey);
  return Ed25519KeyIdentity.generate(entropy);
}

export async function setupAgent(identity: Ed25519KeyIdentity) {
  const agent = await createAgent({ identity, host: HOST });
  const governance = GovernanceCanister.create({ agent, canisterId: GOVERNANCE_ID });
  const ledger = LedgerCanister.create({ agent, canisterId: LEDGER_ID });
  
  return { agent, governance, ledger };
} 