# NeuronAgent

AI agent for Internet Computer governance and neuron management.

## Installation

You can use this package with Deno:

```bash
# Run directly from npm
deno run --allow-net --allow-read --allow-write --allow-env npm:neuronagent

# Or install globally and run
deno install --allow-net --allow-read --allow-write --allow-env --name neuronagent npm:neuronagent
neuronagent
```

## Usage

### As a Command Line Tool

Once installed, you can run the package directly:

```bash
neuronagent
```

### As a Module

You can also import the package in your Deno project:

```typescript
import { start, analyzeProposal, getConfigValue } from "npm:neuronagent";

// Start the service
await start();

// Or use specific functions
const value = await getConfigValue("VOTE_SCHEDULE_DELAY");
const analysis = await analyzeProposal(proposalId);
```

## Configuration

The following configuration options can be set:

- `IC_AUTHENTICATION_KEY`: Authentication key for Internet Computer identity
- `USER_PROMPT`: Custom prompt for AI analysis preferences
- `VOTE_SCHEDULE_DELAY`: Delay in seconds before executing scheduled votes

## API

### Main Functions

- `start()`: Initializes the proposal analysis system and starts the web server
- `analyzeProposal(proposalId)`: Analyzes a proposal and returns the analysis results
- `runProposalAnalysis()`: Starts the background proposal analysis process

### Database Functions

- `getConfigValue(key)`: Gets a configuration value from the database
- `setConfigValue(key, value)`: Sets a configuration value in the database 
- `scheduleVote(proposalId, voteType, timestamp)`: Schedules a vote for a proposal
- `getAgentVote(proposalId)`: Gets the agent's vote for a specific proposal

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/neuronagent.git
cd neuronagent

# Start the development server
deno run --allow-net --allow-read --allow-write --allow-env mod.ts

# Build the project
deno compile --allow-net --allow-read --allow-write --allow-env --output oscillum mod.ts
```

## License

MIT 

## Troubleshooting

### Type Stripping Error

If you encounter an error about type stripping:

```
error: [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules
```

Make sure you're using the latest version of the package. If the error persists, try running with the `--no-check` flag:

```bash
deno run --allow-net --allow-read --allow-write --allow-env --no-check npm:neuronagent
``` # neuron_agent
