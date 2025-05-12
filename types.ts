import { Principal } from "npm:@dfinity/principal";

// Config interface
export interface OscillumConfig {
  OPENAI_KEY?: string;
  IC_AUTHENTICATION_KEY: string;
  USER_PROMPT: string;
  VOTE_SCHEDULE_DELAY?: string;
}



export const HOST = "https://ic0.app";
export const GOVERNANCE_ID = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
export const LEDGER_ID = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
// 6 months and 1 day in seconds
export const SIX_MONTHS_AND_ONE_DAY = (6 * 30 * 24 * 60 * 60) + (1 * 24 * 60 * 60); // 15,638,400 seconds 



// Default configuration
export const DEFAULT_CONFIG: OscillumConfig = {
  IC_AUTHENTICATION_KEY: "",
  USER_PROMPT: `Consider:\n1. Technical implications for the Internet Computer\n2. Security risks and mitigations\n3. Governance precedents being set\n4. Economic impacts\n5. Alignment with the Internet Computer's long-term vision
  Directive:
Vote no on adding new node providers. Vote yes on removing node providers.
Vote no on changing tokenomics parameters.
Vote no on proposals changing code and managing canisters.
Vote yes on proposals moving nodes in and out of subnets proposed by DFINITY.
Vote yes on ExecuteNnsFunction nnsFunctionId 11, 51 and 43 made by DFINITY.
Vote no on ExecuteNnsFunction actions not proposed by DFINITY.  
  `,
  VOTE_SCHEDULE_DELAY: "3600" // Default: 1 hour in seconds
};