import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  Select,
  Badge,
  List,
  ListItem,
  Divider,
  Progress,
  Card,
  CardHeader,
  CardBody,
  Stack,
  Skeleton,
  Alert,
  AlertIcon,
  Code,
  Tag,
  TagLabel,
  HStack,
  VStack,
  useColorModeValue,
  Link,
  Icon,
  Tooltip,
  IconButton,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  useToast,
  Switch
} from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLinkIcon, QuestionIcon, TimeIcon, CloseIcon, CheckIcon, RepeatIcon } from '@chakra-ui/icons';

// Define interface for voteStatus state to fix TypeScript errors
interface VoteStatus {
  loading: boolean;
  success: boolean;
  error: any;
  voteType?: string;
  message?: string;
  scheduled?: boolean;
}

// Format timestamp to readable date
const formatDate = (timestamp) => {
  if (!timestamp || timestamp === "0") return "N/A";
  return new Date(Number(timestamp) * 1000).toLocaleString();
};

// Format timestamp to relative time (e.g., "4 days ago")
const formatRelativeTime = (timestamp) => {
  if (!timestamp || timestamp === "0") return "N/A";
  
  const now = Date.now();
  const time = Number(timestamp) * 1000;
  const diffMs = now - time;
  
  // Convert to seconds, minutes, hours, days
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 30) {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  } else if (diffDays > 0) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffMin > 0) {
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    return 'Just now';
  }
};

// Helper function to format the agent log timestamp - moved outside of Proposals component
const formatAgentTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

// Get status text based on status code
const getStatusText = (status) => {
  const statusMap = {
    0: "Unknown",
    1: "Open",
    2: "Rejected",
    3: "Adopted",
    4: "Executed",
    5: "Failed"
  };
  return statusMap[status] || "Unknown";
};

// Get status colors based on status code
const getStatusColor = (status) => {
  const colorMap = {
    0: "gray",
    1: "yellow",
    2: "red",
    3: "blue",
    4: "green",
    5: "orange"
  };
  return colorMap[status] || "gray";
};

// Get topic text based on topic code
const getTopicText = (topic) => {
  const topicMap = {
    0: "Unspecified",
    1: "Neuron Management", 
    2: "Exchange Rate",
    3: "Network Economics",
    4: "Governance",
    5: "Node Admin",
    6: "Participant Management",
    7: "Subnet Management",
    8: "Network Canister Management",
    9: "KYC",
    10: "Node Provider Rewards",
    12: "Subnet Replica Version Management",
    13: "Replica Version Management",
    14: "SNS and Community Fund"
  };
  return topicMap[topic] || `Topic ${topic}`;
};

// Error display component - moved outside of Proposals component
const ErrorDisplay = ({ proposal, children }) => {
  const [hasError, setHasError] = useState(false);
  
  // Reset error state when proposal changes
  useEffect(() => {
    setHasError(false);
  }, [proposal?.id]);
  
  // Handle rendering with error catching
  const renderContent = () => {
    if (hasError) {
      return (
        <Box p={6}>
          <Alert status="error" mb={4}>
            <AlertIcon />
            There was an error displaying this proposal.
          </Alert>
          <Button size="sm" onClick={() => setHasError(false)}>Try Again</Button>
        </Box>
      );
    }
    
    return children;
  };
  
  // Wrap in error boundary
  try {
    return renderContent();
  } catch (error) {
    console.error("Error rendering proposal:", error);
    // Don't update state during render - defer with useEffect
    if (!hasError) {
      // Use immediate timeout to avoid state updates during render
      setTimeout(() => setHasError(true), 0);
    }
    return (
      <Box p={6}>
        <Alert status="error">
          <AlertIcon />
          Error rendering proposal
        </Alert>
      </Box>
    );
  }
};

// Agent Log Entry component
const AgentLogEntry = ({ log, index }) => {
  const entryBg = useColorModeValue('gray.50', 'gray.800');
  
  return (
    <Box 
      key={log.id} 
      mt={index > 0 ? 4 : 0} 
      p={3} 
      borderWidth="1px" 
      borderRadius="md"
      bg={entryBg}
    >
      <Flex justify="space-between" mb={2}>
        <Text fontWeight="bold">
          Log Entry #{index + 1}
        </Text>
        <Text fontSize="sm" color="gray.500">
          {formatAgentTimestamp(log.createdAt)}
        </Text>
      </Flex>
      
      <Box mb={3}>
        <Text fontWeight="medium" fontSize="sm" mb={1}>Request:</Text>
        <Code p={2} borderRadius="md" fontSize="xs" w="100%" display="block" overflowX="auto" whiteSpace="pre-wrap">
          {log.request}
        </Code>
      </Box>
      
      <Box>
        <Text fontWeight="medium" fontSize="sm" mb={1}>Response:</Text>
        <Code p={2} borderRadius="md" fontSize="xs" w="100%" display="block" overflowX="auto" whiteSpace="pre-wrap">
          {log.response}
        </Code>
      </Box>
    </Box>
  );
};

// Agent Logs Card component
const AgentLogsCard = ({ logs }) => {
  if (logs.length === 0) return null;
  
  return (
    <Card variant="outline" shadow="md" mt={4} overflow="hidden">
      <Accordion allowToggle defaultIndex={[]} borderColor="transparent">
        <AccordionItem border="none">
          <AccordionButton 
            as={Box} 
            py={3} 
            px={4} 
            bg="gray.700" 
            _hover={{ bg: "gray.600" }}
            color="white"
            borderRadius="0"
          >
            <Box flex="1" textAlign="left">
              <Heading size="md">Agent Activity Log ({logs.length} entries)</Heading>
            </Box>
            <AccordionIcon color="white" />
          </AccordionButton>
          
          <AccordionPanel p={0}>
            <Box p={4}>
              {logs
                .map((log, index) => (
                  <AgentLogEntry key={log.id} log={log} index={index} />
                ))}
            </Box>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};

// Agent Analysis Card component
const AgentAnalysisCard = ({ 
  agentVote, 
  agentError, 
  isLoadingAgent, 
  isReevaluating, 
  handleReevaluate,
  getAgentVoteBadgeColor
}) => {
  return (
    <Card variant="outline" shadow="md" mt={4} overflow="hidden">
      <Box bg="gray.700" px={4} py={3}>
        <Flex justify="space-between" align="center">
          <Heading size="md" color="white">AI Agent Analysis</Heading>
          <Button
            size="sm"
            colorScheme="blue"
            leftIcon={<RepeatIcon />}
            onClick={handleReevaluate}
            isLoading={isReevaluating}
            loadingText="Restarting..."
            isDisabled={isLoadingAgent || isReevaluating}
          >
            Reevaluate
          </Button>
        </Flex>
      </Box>
      
      <Box p={4}>
        {isLoadingAgent || isReevaluating ? (
          <Box textAlign="center">
            <Spinner size="md" />
            <Text mt={2}>{isReevaluating ? "Restarting analysis..." : "Loading AI analysis..."}</Text>
          </Box>
        ) : agentError ? (
          <Alert status="error">
            <AlertIcon />
            {agentError}
          </Alert>
        ) : !agentVote ? (
          <Box textAlign="center">
            <Text color="gray.500">No AI analysis available for this proposal</Text>
          </Box>
        ) : (
          <Flex justify="space-between" align="flex-start">
            <Box>
              <Flex align="center" mb={2}>
                <Text fontWeight="bold" mr={2}>Decision:</Text>
                <Badge 
                  colorScheme={getAgentVoteBadgeColor(agentVote.voteType)} 
                  px={2} 
                  py={1} 
                  borderRadius="full"
                  fontSize="md"
                >
                  {agentVote.voteType === "yes" && <CheckIcon mr={1} boxSize={3} />}
                  {agentVote.voteType === "no" && <CloseIcon mr={1} boxSize={3} />}
                  {agentVote.voteType.toUpperCase()}
                </Badge>
                {agentVote.scheduled && (
                  <Badge ml={2} colorScheme="blue">Vote Scheduled</Badge>
                )}
              </Flex>
              <Text fontWeight="bold" mb={2}>Reasoning:</Text>
              <Text whiteSpace="pre-wrap">{agentVote.reasoning}</Text>
            </Box>
            <Text fontSize="sm" color="gray.500">
              Analyzed on {formatAgentTimestamp(agentVote.createdAt)}
            </Text>
          </Flex>
        )}
      </Box>
    </Card>
  );
};

const Proposals = () => {
  const toast = useToast();
  
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [userNeurons, setUserNeurons] = useState([]);
  const [neuronId, setNeuronId] = useState(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>({ loading: false, success: false, error: null });
  const [pendingVotes, setPendingVotes] = useState({});
  const [remainingTime, setRemainingTime] = useState({});
  const [agentVote, setAgentVote] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [agentError, setAgentError] = useState(null);
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [voteDelay, setVoteDelay] = useState(3600); // Default to 3600 seconds (1 hour)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true); // Default to enabled
  
  // Chakra UI color mode values for theming
  const cardBg = useColorModeValue('white', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.600');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  // Additional color values for proposal list items
  const proposalIdColor = useColorModeValue("gray.500", "gray.400");
  const proposalDateColor = useColorModeValue("gray.500", "gray.400");
  
  // Pre-compute all color mode values for the detail view
  const summaryLabelColor = useColorModeValue('gray.600', 'gray.300');
  const votingResultsLabelColor = useColorModeValue('gray.600', 'gray.300');
  const proposedLabelColor = useColorModeValue('gray.600', 'gray.300');
  const deadlineLabelColor = useColorModeValue('gray.600', 'gray.300');
  const decidedLabelColor = useColorModeValue('gray.600', 'gray.300');
  const executedLabelColor = useColorModeValue('gray.600', 'gray.300');
  const actionLabelColor = useColorModeValue('gray.600', 'gray.300');
  const tallyTimeColor = useColorModeValue('gray.500', 'gray.400');
  const preBgColor = useColorModeValue('gray.50', 'gray.700');
  const preTextColor = useColorModeValue('gray.800', 'gray.100');
  const blockquoteBorderColor = useColorModeValue('gray.200', 'gray.600');
  const tableBorderColor = useColorModeValue("gray.200", "gray.600");
  const noProposalColor = useColorModeValue("gray.500", "gray.400");

  useEffect(() => {
    fetchProposals();
    fetchVoteDelay();
  }, [page]);

  useEffect(() => {
    fetchUserNeurons();
  }, []);

  useEffect(() => {
    // Initial check for pending votes
    if (selectedProposal) {
      checkVoteStatus(selectedProposal.id);
    }
    
    // Set up interval to refresh time remaining
    const timerId = setInterval(() => {
      updateRemainingTime();
    }, 1000);
    
    return () => clearInterval(timerId);
  }, [selectedProposal, pendingVotes]);
  
  // Update time remaining for pending votes
  const updateRemainingTime = () => {
    const now = Math.floor(Date.now() / 1000);
    const updatedTimes = {};
    let hasChanges = false;
    
    Object.keys(pendingVotes).forEach(proposalId => {
      const vote = pendingVotes[proposalId];
      if (vote) {
        const remaining = Math.max(0, vote.scheduledTime - now);
        updatedTimes[proposalId] = remaining;
        
        // If time is up, refresh vote status
        if (remaining === 0 && remainingTime[proposalId] > 0) {
          hasChanges = true;
          setTimeout(() => checkVoteStatus(proposalId), 2000); // Check after 2 seconds
        }
      }
    });
    
    setRemainingTime(prev => ({...prev, ...updatedTimes}));
    
    // If any vote completed, refresh the proposal
    if (hasChanges && selectedProposal) {
      setTimeout(() => refreshProposal(selectedProposal.id), 3000); // Refresh after 3 seconds
    }
  };
  
  // Check vote status for all proposals in the list
  const checkAllProposalsVoteStatus = useCallback(async () => {
    if (!proposals || proposals.length === 0) return;
    
    // Process in batches to avoid too many concurrent requests
    const batchSize = 5;
    for (let i = 0; i < proposals.length; i += batchSize) {
      const batch = proposals.slice(i, i + batchSize);
      
      // Create an array of promises
      const promises = batch.map(proposal => 
        fetch(`/api/proposals/${proposal.id}/vote-status`)
          .then(response => {
            if (!response.ok) throw new Error('Failed to fetch vote status');
            return response.json();
          })
          .then(data => {
            if (data.scheduledVote) {
              // Update pending votes
              setPendingVotes(prev => ({
                ...prev,
                [proposal.id]: data.scheduledVote
              }));
              
              // Initialize remaining time
              const now = Math.floor(Date.now() / 1000);
              const remaining = Math.max(0, data.scheduledVote.scheduledTime - now);
              setRemainingTime(prev => ({
                ...prev,
                [proposal.id]: remaining
              }));
            }
          })
          .catch(err => console.error(`Error checking vote status for proposal ${proposal.id}:`, err))
      );
      
      // Wait for all promises in the batch to resolve
      await Promise.all(promises);
    }
  }, [proposals]);
  
  // Call checkAllProposalsVoteStatus when proposals are loaded
  useEffect(() => {
    if (proposals && proposals.length > 0) {
      checkAllProposalsVoteStatus();
    }
  }, [proposals, checkAllProposalsVoteStatus]);
  
  // Check vote status for a specific proposal
  const checkVoteStatus = async (proposalId) => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}/vote-status`);
      if (!response.ok) {
        throw new Error('Failed to fetch vote status');
      }
      
      const data = await response.json();
      
      if (data.scheduledVote) {
        setPendingVotes(prev => ({
          ...prev,
          [proposalId]: data.scheduledVote
        }));
        
        // Initialize remaining time
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, data.scheduledVote.scheduledTime - now);
        setRemainingTime(prev => ({
          ...prev,
          [proposalId]: remaining
        }));
      } else {
        // Remove from pending votes if not found
        setPendingVotes(prev => {
          const updated = {...prev};
          delete updated[proposalId];
          return updated;
        });
      }
    } catch (err) {
      console.error('Error checking vote status:', err);
    }
  };

  const fetchUserNeurons = async () => {
    try {
      // First try to get the neuron ID from the database
      const response = await fetch('/api/user/neuron');
      
      if (!response.ok) {
        throw new Error('Failed to fetch user neuron from database');
      }
      
      const data = await response.json();
      
      if (data && data.neuronId) {
        // If we have the neuron ID in the database, use it
        setNeuronId(data.neuronId);
        setUserNeurons([{ id: data.neuronId }]);
        console.log('User neuron from database:', data.neuronId);
      } else {
        // Fall back to fetching from IC if not in database
        const icResponse = await fetch('/api/neurons');
        
        if (!icResponse.ok) {
          throw new Error('Failed to fetch user neurons from IC');
        }
        
        const icData = await icResponse.json();
        setUserNeurons(icData.neurons || []);
        
        if (icData.neurons && icData.neurons.length > 0) {
          setNeuronId(icData.neurons[0].id);
          console.log('User neurons from IC:', icData.neurons);
          
          // Store the neuron ID in the database for future use
          await fetch('/api/user/neuron', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ neuronId: icData.neurons[0].id }),
          });
        }
      }
    } catch (err) {
      console.error('Error fetching neurons:', err);
      // Don't set the error state to avoid interfering with proposals loading
    }
  };

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proposals?page=${page}&limit=10`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch proposals');
      }
      
      const data = await response.json();
      
      // Update proposals - handle transition smoothly
      setProposals(prevProposals => {
        // If we're refreshing on the same page, preserve selection
        if (selectedProposal && data.proposals) {
          // Update the selected proposal if it's in the new list
          const updatedSelected = data.proposals.find(p => p.id === selectedProposal.id);
          if (updatedSelected) {
            setSelectedProposal(updatedSelected);
          }
        }
        return data.proposals;
      });
      
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProposalClick = (proposal, e) => {
    console.log('Proposal structure:', proposal);
    
    // Log ballot information for debugging
    if (proposal && proposal.ballots) {
      console.log('Ballot structure:', proposal.ballots);
      if (Array.isArray(proposal.ballots)) {
        console.log('Ballot is an array with length:', proposal.ballots.length);
      } else {
        console.log('Ballot is an object with keys:', Object.keys(proposal.ballots));
      }
    }
    
    try {
      if (!proposal || typeof proposal !== 'object') {
        console.error('Invalid proposal object:', proposal);
        return;
      }
      
      // Reset vote status when selecting a different proposal
      if (!selectedProposal || selectedProposal.id !== proposal.id) {
        setVoteStatus({ loading: false, success: false, error: null });
        // Reset agent data
        setAgentVote(null);
        setAgentLogs([]);
        // Fetch agent analysis for the new proposal
        fetchAgentAnalysis(proposal.id);
      }
      
    setSelectedProposal(proposal);
      
      // Check if this proposal has a pending vote
      checkVoteStatus(proposal.id);
    } catch (err) {
      console.error('Error selecting proposal:', err);
    }
  };

  // Calculate voting percentages
  const calculateVotePercentage = (tally) => {
    if (!tally || !tally.yes || !tally.no) return { yes: 0, no: 0, undecided: 100 };
    
    try {
      const yesVotes = BigInt(tally.yes || 0);
      const noVotes = BigInt(tally.no || 0);
      
      // If total is not provided, estimate based on yes + no votes
      // In a real-world scenario, this would ideally come from the API
      const totalVotingPower = tally.total ? BigInt(tally.total) : (yesVotes + noVotes);
      
      if (totalVotingPower === 0n) return { yes: 0, no: 0, undecided: 100 };
      
      // Calculate percentages based on total voting power
      const yesPercentage = Number((yesVotes * 100n) / totalVotingPower);
      const noPercentage = Number((noVotes * 100n) / totalVotingPower);
      
      // If we don't have real total voting power, there's no undecided percentage
      const hasRealTotal = tally.total && tally.total > (tally.yes + tally.no);
      const undecidedPercentage = hasRealTotal ? Math.max(0, 100 - yesPercentage - noPercentage) : 0;
      
      return { 
        yes: yesPercentage, 
        no: noPercentage, 
        undecided: undecidedPercentage
      };
    } catch (error) {
      console.error("Error calculating vote percentages:", error);
      return { yes: 0, no: 0, undecided: 100 };
    }
  };

  // Get vote status for user from actual ballot data
  const getUserVote = (proposal) => {
    if (!proposal || !neuronId) {
      return { status: "not_eligible", label: "", color: "gray" };
    }
    
    try {
      // We now have a single neuron ID instead of an array
      const userNeuronId = neuronId;
      
      // Check if the user's neuron is eligible to vote (exists in ballots)
      let isEligible = false;
      
      // Check if this proposal has ballots
      // Handle case where ballots could be in different formats
      if (proposal.ballots) {
        // Format 1: Object with neuronId as keys
        const userBallot = proposal.ballots[userNeuronId];
        if (userBallot) {
          isEligible = true;
          if (userBallot.vote === 1) {
            return { status: "yes", label: "YES", color: "green" };
          } else if (userBallot.vote === 2) {
            return { status: "no", label: "NO", color: "red" };
          }
          // vote: 0 means the neuron can vote but hasn't voted yet
        }
      }
      
      // Format 2: Array of ballot objects
      if (Array.isArray(proposal.ballots)) {
        for (const ballot of proposal.ballots) {
          if (ballot.neuronId?.toString() === userNeuronId) {
            isEligible = true;
            if (ballot.vote === 1) {
              return { status: "yes", label: "YES", color: "green" };
            } else if (ballot.vote === 2) {
              return { status: "no", label: "NO", color: "red" };
            }
            // vote: 0 means the neuron can vote but hasn't voted yet
          }
        }
      }
      
      // If eligible but hasn't voted, return undecided
      if (isEligible) {
        return { status: "undecided", label: "", color: "gray" };
      }
      
      // Not eligible to vote
      return { status: "not_eligible", label: "", color: "gray" };
    } catch (error) {
      console.error("Error checking user vote:", error);
      return { status: "not_eligible", label: "", color: "gray" };
    }
  };

  // Fetch the vote delay preference
  const fetchVoteDelay = async () => {
    try {
      const response = await fetch('/api/config?key=VOTE_SCHEDULE_DELAY');
      const data = await response.json();
      
      if (data.status === 'success' && data.value) {
        setVoteDelay(parseInt(data.value));
        console.log(`Using vote schedule delay from config: ${data.value} seconds`);
      } else {
        console.log('No custom vote delay configured, using default: 3600 seconds');
        setVoteDelay(3600); // Default to 1 hour
      }
    } catch (error) {
      console.error('Error fetching vote delay preference:', error);
      // Keep the default value if there's an error
    }
  };

  // Handle scheduling a vote on a proposal
  const handleVote = async (vote) => {
    if (!selectedProposal) return;
    
    setVoteStatus({ loading: true, success: false, error: null, voteType: vote });
    
    try {
      const response = await fetch(`/api/proposals/${selectedProposal.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vote, immediate: false, delaySeconds: voteDelay })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to schedule vote');
      }
      
      // Update pending votes
      if (data.scheduledVote) {
        setPendingVotes(prev => ({
          ...prev,
          [selectedProposal.id]: data.scheduledVote
        }));
        
        // Initialize remaining time
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, data.scheduledVote.scheduledTime - now);
        setRemainingTime(prev => ({
          ...prev,
          [selectedProposal.id]: remaining
        }));
      }
      
      // Calculate formatted time for the success message
      let delayMessage;
      if (voteDelay < 60) {
        delayMessage = `${voteDelay} seconds`;
      } else if (voteDelay < 3600) {
        delayMessage = `${Math.floor(voteDelay / 60)} minutes`;
      } else {
        const hours = Math.floor(voteDelay / 3600);
        const minutes = Math.floor((voteDelay % 3600) / 60);
        delayMessage = hours + (minutes > 0 ? ` hours ${minutes} minutes` : ` hour${hours > 1 ? 's' : ''}`);
      }
      
      // Show success message
      setVoteStatus({ 
        loading: false, 
        success: true, 
        error: null,
        message: `Your ${vote} vote has been scheduled and will be executed in ${delayMessage}. You can cancel it anytime before then.`,
        scheduled: true,
        voteType: vote
      });
    } catch (err) {
      setVoteStatus({ 
        loading: false, 
        success: false, 
        error: err.message || 'Failed to schedule vote',
        voteType: vote 
      });
    }
  };
  
  // Cancel a scheduled vote
  const cancelVote = async () => {
    if (!selectedProposal) return;
    
    try {
      setVoteStatus({ loading: true, success: false, error: null });
      
      const response = await fetch(`/api/proposals/${selectedProposal.id}/cancel-vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel vote');
      }
      
      // Remove from pending votes
      setPendingVotes(prev => {
        const updated = {...prev};
        delete updated[selectedProposal.id];
        return updated;
      });
      
      // Show success message
      setVoteStatus({ 
        loading: false, 
        success: true, 
        error: null,
        message: 'Vote canceled successfully'
      });
    } catch (err) {
      setVoteStatus({ 
        loading: false, 
        success: false, 
        error: err.message || 'Failed to cancel vote'
      });
    }
  };
  
  // Format remaining time for display
  const formatRemainingTime = (seconds) => {
    if (seconds <= 0) return 'Processing...';
    
    // Format as hours:minutes:seconds for better readability with 1 hour delay
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };
  
  // Refresh a single proposal
  const refreshProposal = async (id) => {
    try {
      const response = await fetch(`/api/proposals/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch proposal');
      }
      
      const data = await response.json();
      if (data.proposal) {
        // Update the selectedProposal
        setSelectedProposal(data.proposal);
        
        // Also update the proposal in the proposals list
        setProposals(prev => prev.map(p => 
          p.id === id ? { ...p, ...data.proposal } : p
        ));
      }
    } catch (err) {
      console.error('Error refreshing proposal:', err);
    }
  };

  // Check if voting is still allowed for a proposal based on deadline
  const isVotingAllowed = (proposal) => {
    if (!proposal || !proposal.proposalTimestampSeconds || !proposal.deadlineTimestampSeconds) {
      return false;
    }
    
    try {
      // Calculate deadline timestamp
      const proposalTimestamp = Number(proposal.proposalTimestampSeconds);
      const durationSeconds = Number(proposal.deadlineTimestampSeconds);
      const deadlineTimestamp = proposalTimestamp + durationSeconds;
      
      // Compare with current time
      const currentTimestamp = Math.floor(Date.now() / 1000);
      return currentTimestamp < deadlineTimestamp;
    } catch (error) {
      console.error("Error checking voting deadline:", error);
      return false;
    }
  };

  // Add a new function to fetch agent vote and logs
  const fetchAgentAnalysis = async (proposalId) => {
    if (!proposalId) return;
    
    setIsLoadingAgent(true);
    setAgentError(null);
    
    try {
      // Fetch agent vote
      const voteResponse = await fetch(`/api/proposals/${proposalId}/agent-vote`);
      const voteData = await voteResponse.json();
      
      if (voteData.status === 'success' && voteData.agentVote) {
        setAgentVote(voteData.agentVote);
      } else {
        setAgentVote(null);
      }
      
      // Fetch agent logs
      const logsResponse = await fetch(`/api/proposals/${proposalId}/agent-logs`);
      const logsData = await logsResponse.json();
      
      if (logsData.status === 'success') {
        setAgentLogs(logsData.logs || []);
      } else {
        setAgentLogs([]);
      }
    } catch (error) {
      console.error('Error fetching agent analysis:', error);
      setAgentError('Failed to load AI analysis data');
    } finally {
      setIsLoadingAgent(false);
    }
  };

  // Update the getAgentVoteBadgeColor function to only handle yes/no
  const getAgentVoteBadgeColor = (voteType) => {
    if (!voteType) return 'gray';
    switch (voteType.toLowerCase()) {
      case 'yes': return 'green';
      case 'no': return 'red';
      default: return 'gray';
    }
  };

  // Add this new function to handle reevaluation
  const handleReevaluate = async () => {
    if (!selectedProposal) return;
    
    setIsReevaluating(true);
    setAgentError(null);
    
    try {
      // 1. Call API to reset agent data for this proposal
      const response = await fetch(`/api/proposals/${selectedProposal.id}/reset-agent-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset analysis');
      }
      
      // 2. Clear local state
      setAgentVote(null);
      setAgentLogs([]);
      
      // 3. Wait a moment then trigger a refresh of the proposal data
      setTimeout(async () => {
        try {
          // Refresh the proposal data
          await refreshProposal(selectedProposal.id);
          
          // Trigger the analysis process on the backend
          const triggerResponse = await fetch(`/api/proposals/${selectedProposal.id}/trigger-analysis`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (!triggerResponse.ok) {
            throw new Error('Failed to trigger new analysis');
          }
          
          // Show a temporary message
          toast({
            title: "Analysis started",
            description: "The AI analysis has been restarted. Results will appear soon.",
            status: "info",
            duration: 5000,
            isClosable: true,
          });
          
          // Store the proposal ID for polling
          const proposalIdForPolling = selectedProposal.id;
          
          // Poll for updates every few seconds
          let attempts = 0;
          const maxAttempts = 10;
          
          const pollForResults = async () => {
            if (attempts >= maxAttempts) {
              setIsReevaluating(false);
              return;
            }
            
            attempts++;
            try {
              // Fetch the latest vote and logs
              const voteResponse = await fetch(`/api/proposals/${proposalIdForPolling}/agent-vote`);
              const voteData = await voteResponse.json();
              
              const logsResponse = await fetch(`/api/proposals/${proposalIdForPolling}/agent-logs`);
              const logsData = await logsResponse.json();
              
              // Update state with fetched data
              if (voteData.status === 'success' && voteData.agentVote) {
                setAgentVote(voteData.agentVote);
                setIsReevaluating(false);
                return; // We have results, stop polling
              }
              
              if (logsData.status === 'success') {
                setAgentLogs(logsData.logs || []);
              }
              
              // Continue polling
              setTimeout(pollForResults, 3000);
            } catch (error) {
              console.error('Error polling for analysis results:', error);
              setIsReevaluating(false);
            }
          };
          
          // Start polling after a short delay
          setTimeout(pollForResults, 3000);
        } catch (error) {
          console.error('Error in refresh/trigger phase:', error);
          setAgentError(`Failed to trigger analysis: ${error.message}`);
          setIsReevaluating(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error reevaluating proposal:', error);
      setAgentError(`Failed to reevaluate: ${error.message}`);
      setIsReevaluating(false);
      
      toast({
        title: "Reevaluation failed",
        description: error.message || "There was an error restarting the analysis",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    // Set up automatic refresh every minute
    if (autoRefreshEnabled) {
      const refreshInterval = setInterval(() => {
        console.log("Auto-refreshing proposals list...");
        setIsAutoRefreshing(true);
        fetchProposals().finally(() => {
          setIsAutoRefreshing(false);
        });
        // Also refresh vote statuses for all proposals
        checkAllProposalsVoteStatus();
      }, 60000); // 1 minute in milliseconds
      
      // Clear interval on component unmount
      return () => clearInterval(refreshInterval);
    }
  }, [autoRefreshEnabled, page]); // Re-establish timer if page or autoRefreshEnabled changes

  return (
    <Container maxW="container.xl" py={4} pb={20} mb={20}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="lg">Proposals</Heading>
        <HStack spacing={3}>
          <Tooltip label={autoRefreshEnabled ? "Auto-refresh every minute" : "Auto-refresh disabled"}>
            <Switch 
              size="sm" 
              isChecked={autoRefreshEnabled} 
              onChange={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              colorScheme="blue"
            />
          </Tooltip>
          <Button
            size="sm"
            leftIcon={isAutoRefreshing ? <Spinner size="xs" /> : <RepeatIcon />}
            onClick={() => {
              setIsAutoRefreshing(true);
              fetchProposals().finally(() => {
                setIsAutoRefreshing(false);
                toast({
                  title: "Refreshed",
                  description: "Proposal list has been updated",
                  status: "success",
                  duration: 2000,
                  isClosable: true,
                });
              });
              checkAllProposalsVoteStatus();
            }}
            isLoading={isAutoRefreshing}
            loadingText="Refreshing"
          >
            Refresh
          </Button>
        </HStack>
      </Flex>
      
      {/* Display user neurons */}
      <Box mb={4}>
        <Flex align="center">
          <Text fontSize="sm" fontWeight="medium" mr={2}>Your Neuron:</Text>
          {loading ? (
            <Text fontSize="sm" color="gray.500">Loading neuron...</Text>
          ) : neuronId ? (
            <Link 
              href={`https://dashboard.internetcomputer.org/neuron/${neuronId}`} 
              isExternal
              fontSize="sm"
              color="blue.500"
              textDecoration="underline"
              _hover={{ color: "blue.600" }}
            >
              {neuronId}
            </Link>
          ) : (
            <Text fontSize="sm" color="gray.500">No neuron found</Text>
          )}
      </Flex>
      </Box>
      
      {loading ? (
        <Stack spacing={4}>
          <Skeleton height="60px" />
          <Skeleton height="60px" />
          <Skeleton height="60px" />
        </Stack>
      ) : error ? (
        <Alert status="error">
          <AlertIcon />
          Error: {error}
        </Alert>
      ) : proposals.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          No proposals found.
        </Alert>
      ) : (
        <Grid 
          templateColumns={{ base: '1fr', md: '400px 1fr' }} 
          gap={3}
          maxW="100%"
        >
          {/* Proposals List Column */}
          <GridItem overflow="hidden">
            <Card variant="outline" shadow="md">
              <List spacing={0}>
                {proposals.map((proposal, index) => (
                  <React.Fragment key={proposal.id}>
                    {index > 0 && <Divider />}
                    <ListItem 
                      p={3}
                      cursor="pointer"
                      bg={selectedProposal?.id === proposal.id ? selectedBg : cardBg}
                      _hover={{ bg: hoverBg }}
                      onClick={(e) => handleProposalClick(proposal, e)}
                      position="relative"
                    >
                      <Flex justify="space-between" align="center" width="100%">
                        {/* Proposal Information - Left Side */}
                        <Box flex="1">
                          <VStack align="stretch" spacing={1}>
                            <Flex justify="space-between">
                              <Text 
                                fontWeight="medium" 
                                fontSize="sm"
                                sx={{
                                  wordBreak: "break-all",
                                  overflowWrap: "break-word",
                                  hyphens: "auto",
                                  maxWidth: "70%",
                                  whiteSpace: "normal"
                                }}
                              >
                                {proposal.proposal?.title || `Proposal ${proposal.id}`}
                                    <Text as="span" ml={2} fontWeight="normal" color={proposalIdColor} fontSize="xs">
                                  #{proposal.id}
                                </Text>
                              </Text>
                            </Flex>
                            
                            <Flex justify="space-between" align="center">
                              <Badge 
                                colorScheme={getStatusColor(proposal.status)}
                                variant="subtle"
                                fontSize="xs"
                                borderRadius="full"
                                px={2}
                              >
                                {getStatusText(proposal.status)}
                              </Badge>
                                  <Text fontSize="xs" color={proposalDateColor}>
                                    {formatRelativeTime(proposal.proposalTimestampSeconds)}
                              </Text>
                            </Flex>
                          </VStack>
                        </Box>
                        
                        {/* Vote Indicator - Right Side */}
                        <Flex 
                          minWidth="60px" 
                          justifyContent="center" 
                          alignItems="center"
                          ml={3}
                        >
                          {getUserVote(proposal).status === "yes" ? (
                            <Text
                              color="green.400"
                              fontSize="sm"
                              fontWeight="bold"
                            >
                              YES ✓
                            </Text>
                          ) : getUserVote(proposal).status === "no" ? (
                            <Text
                              color="red.400"
                              fontSize="sm"
                              fontWeight="bold"
                            >
                              NO ✗
                            </Text>
                          ) : pendingVotes[proposal.id] ? (
                            <Tooltip label={`${pendingVotes[proposal.id].voteType === 'yes' ? 'Yes' : 'No'} vote scheduled in ${formatRemainingTime(remainingTime[proposal.id])}. Will be automatically executed when timer expires.`}>
                              <Flex align="center">
                                <TimeIcon color={pendingVotes[proposal.id].voteType === 'yes' ? "green.400" : "red.400"} boxSize={4} mr={1} />
                                <Text
                                  color={pendingVotes[proposal.id].voteType === 'yes' ? "green.400" : "red.400"}
                                  fontSize="xs"
                                  fontWeight="bold"
                                >
                                  {pendingVotes[proposal.id].voteType === 'yes' ? 'YES' : 'NO'}
                                </Text>
                              </Flex>
                            </Tooltip>
                          ) : getUserVote(proposal).status === "undecided" ? (
                            <QuestionIcon color="gray.400" boxSize={4} />
                          ) : null}
                        </Flex>
                      </Flex>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Card>
            
            <Flex justify="space-between" align="center" mt={4}>
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                isDisabled={page === 1}
                size="sm"
                colorScheme="gray"
              >
                Previous
              </Button>
              <Text fontSize="sm">Page {page} of {totalPages}</Text>
              <Button
                onClick={() => setPage(p => p + 1)}
                isDisabled={page >= totalPages}
                size="sm"
                colorScheme="gray"
              >
                Next
              </Button>
            </Flex>
          </GridItem>
          
          {/* Proposal Details Column */}
          <GridItem overflow="hidden">
            {selectedProposal ? (
              <>
                {/* Main Proposal Card */}
                <Card variant="outline" shadow="md" overflow="hidden">
                  <ErrorDisplay proposal={selectedProposal}>
                    <CardHeader borderBottomWidth="1px" borderColor={borderColor} pb={3} pt={3} position="relative">
                      <Flex justify="space-between" align="center" width="100%">
                        {/* Proposal Information - Left Side */}
                        <Box flex="1">
                          <VStack align="stretch" spacing={1}>
                    <Heading size="md" sx={{
                      wordBreak: "break-all", 
                      overflowWrap: "break-word",
                      hyphens: "auto",
                      maxWidth: "70%",
                      marginRight: "auto"
                    }}>
                      {selectedProposal.proposal?.title || `Proposal ${selectedProposal.id}`}
                    </Heading>
                    <HStack spacing={2}>
                      <Tag size="sm" borderRadius="full" variant="outline">
                        <TagLabel>ID: {selectedProposal.id}</TagLabel>
                                <Link 
                                  href={`https://dashboard.internetcomputer.org/proposal/${selectedProposal.id}`}
                                  isExternal
                                  ml={1}
                                  _hover={{ color: "blue.500" }}
                                >
                                  <Icon as={ExternalLinkIcon} boxSize={3} />
                                </Link>
                      </Tag>
                      <Badge 
                        colorScheme={getStatusColor(selectedProposal.status)}
                        borderRadius="full"
                        px={2}
                      >
                        {getStatusText(selectedProposal.status)}
                      </Badge>
                      <Badge colorScheme="purple" borderRadius="full" px={2}>
                        {getTopicText(selectedProposal.topic)}
                      </Badge>
                    </HStack>
                  </VStack>
                        </Box>

                        {/* Vote Indicator - Right Side */}
                        <Flex 
                          minWidth="80px" 
                          justifyContent="center" 
                          alignItems="center"
                          ml={4}
                        >
                          {getUserVote(selectedProposal).status === "yes" ? (
                            <Text
                              color="green.400"
                              fontSize="md"
                              fontWeight="bold"
                            >
                              YES ✓
                            </Text>
                          ) : getUserVote(selectedProposal).status === "no" ? (
                            <Text
                              color="red.400"
                              fontSize="md"
                              fontWeight="bold"
                            >
                              NO ✗
                            </Text>
                          ) : pendingVotes[selectedProposal?.id] ? (
                            <Flex direction="column" align="center">
                              <HStack>
                                <Badge
                                  colorScheme={pendingVotes[selectedProposal.id].voteType === 'yes' ? "green" : "red"}
                                  fontSize="sm"
                                  borderRadius="sm"
                                  px={2}
                                  py={1}
                                >
                                  {pendingVotes[selectedProposal.id].voteType === 'yes' ? 'YES' : 'NO'}
                                </Badge>
                                <TimeIcon boxSize={4} color="blue.400" />
                                <Text fontSize="xs" fontWeight="bold">{formatRemainingTime(remainingTime[selectedProposal.id])}</Text>
                                <IconButton
                                  icon={<CloseIcon />}
                                  size="xs"
                                  aria-label="Cancel vote"
                                  variant="ghost"
                                  color="red.400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelVote();
                                  }}
                                />
                              </HStack>
                              <Text fontSize="xs" color="gray.400" mt={1}>
                                Scheduled vote - will be cast in {formatRemainingTime(remainingTime[selectedProposal.id])}
                              </Text>
                            </Flex>
                          ) : getUserVote(selectedProposal).status === "undecided" && isVotingAllowed(selectedProposal) ? (
                            <Flex direction="row" align="center" gap={2}>
                              <Button 
                                colorScheme="green" 
                                size="sm"
                                px={4}
                                isDisabled={voteStatus.loading}
                                isLoading={voteStatus.loading && voteStatus.voteType === "yes"}
                                onClick={() => handleVote("yes")}
                                loadingText="..."
                              >
                                Yes
                              </Button>
                              
                              <Button 
                                colorScheme="red" 
                                size="sm"
                                px={4}
                                isDisabled={voteStatus.loading}
                                isLoading={voteStatus.loading && voteStatus.voteType === "no"}
                                onClick={() => handleVote("no")}
                                loadingText="..."
                              >
                                No
                              </Button>
                            </Flex>
                          ) : null}
                        </Flex>
                      </Flex>
                </CardHeader>
                
                    <CardBody overflowX="auto" pt={3} pb={3}>
                      <VStack align="stretch" spacing={4} maxW="100%">
                    <Box>
                          <Text fontWeight="medium" color={summaryLabelColor} mb={1} fontSize="sm">
                        Summary
                      </Text>
                          <Box 
                            fontSize="sm" 
                            sx={{
                              "& table": {
                                borderCollapse: "collapse",
                                width: "100%",
                                overflowX: "auto",
                                display: "block",
                              },
                              "& td, & th": {
                                borderWidth: "1px",
                                borderColor: tableBorderColor,
                                px: 2,
                                py: 1
                              },
                              "& pre code": {
                                whiteSpace: "pre-wrap"
                              }
                            }}
                          >
                            {selectedProposal?.proposal?.summary ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                                allowedElements={[
                                  'p', 'br', 'strong', 'em', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'del', 'table',
                                  'thead', 'tbody', 'tr', 'th', 'td'
                                ]}
                                unwrapDisallowed={true}
                            components={{
                              p: props => <Text mb={2} {...props} />,
                                  a: props => <Link color="blue.500" isExternal rel="noopener noreferrer" {...props} />,
                              h1: props => <Heading size="md" mt={4} mb={2} {...props} />,
                              h2: props => <Heading size="sm" mt={3} mb={2} {...props} />,
                              h3: props => <Text fontWeight="bold" mt={2} mb={1} {...props} />,
                              ul: props => <Box as="ul" pl={4} mb={2} {...props} />,
                              ol: props => <Box as="ol" pl={4} mb={2} {...props} />,
                              li: props => <Box as="li" mb={1} {...props} />,
                                  code: props => <Code p={1} colorScheme="gray" {...props} />,
                              pre: props => (
                                <Box
                                  as="pre"
                                  mt={2}
                                  mb={2}
                                  p={2}
                                  borderRadius="md"
                                      bg={preBgColor}
                                  overflowX="auto"
                                  fontSize="xs"
                                      maxW="100%"
                                  {...props}
                                />
                              ),
                              blockquote: props => (
                                <Box
                                  as="blockquote"
                                  borderLeftWidth="4px"
                                      borderLeftColor={blockquoteBorderColor}
                                  pl={4}
                                  py={1}
                                  my={2}
                                  {...props}
                                />
                              ),
                            }}
                          >
                                {selectedProposal.proposal.summary || ''}
                          </ReactMarkdown>
                        ) : (
                          <Text>No summary available</Text>
                        )}
                      </Box>
                          {selectedProposal?.proposal?.url && (
                        <Button 
                          as="a"
                          href={selectedProposal.proposal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="link"
                          colorScheme="blue"
                          size="sm"
                          mt={2}
                        >
                          View proposal details
                        </Button>
                      )}
                    </Box>
                    
                        {selectedProposal?.latestTally && (
                      <Box>
                            <Text fontWeight="medium" color={votingResultsLabelColor} mb={1} fontSize="sm">
                          Voting Results
                        </Text>
                            
                            <Box position="relative" h="8px" w="100%" borderRadius="full" overflow="hidden" bg="gray.200" _dark={{ bg: "gray.600" }}>
                              {/* Left: Yes votes (green) */}
                              <Box 
                                position="absolute"
                                left="0"
                                top="0"
                                h="100%"
                                w={`${calculateVotePercentage(selectedProposal.latestTally).yes}%`}
                                bg="green.500"
                              />
                              
                              {/* Right: No votes (red) */}
                              <Box 
                                position="absolute"
                                right="0"
                                top="0"
                                h="100%"
                                w={`${calculateVotePercentage(selectedProposal.latestTally).no}%`}
                                bg="red.500"
                              />
                            </Box>
                            
                            <Flex justify="space-between" fontSize="xs" mt={2}>
                              <HStack>
                                <Box w="10px" h="10px" borderRadius="sm" bg="green.500" />
                                <Text>Yes: {calculateVotePercentage(selectedProposal.latestTally).yes.toFixed(1)}%</Text>
                              </HStack>
                              {calculateVotePercentage(selectedProposal.latestTally).undecided > 0 && (
                                <HStack>
                                  <Box w="10px" h="10px" borderRadius="sm" bg="gray.400" _dark={{ bg: "gray.600" }} />
                                  <Text>Undecided: {calculateVotePercentage(selectedProposal.latestTally).undecided.toFixed(1)}%</Text>
                                </HStack>
                              )}
                              <HStack>
                                <Box w="10px" h="10px" borderRadius="sm" bg="red.500" />
                                <Text>No: {calculateVotePercentage(selectedProposal.latestTally).no.toFixed(1)}%</Text>
                              </HStack>
                        </Flex>
                            
                            {/* Display a note if we don't have total voting power */}
                            {!selectedProposal.latestTally.total && (
                              <Text fontSize="xs" color="orange.500" mt={1}>
                                Note: Total voting power unavailable - showing only yes/no votes
                              </Text>
                            )}
                            
                            <Text fontSize="xs" color={tallyTimeColor} mt={1}>
                          As of {formatDate(selectedProposal.latestTally.timestampSeconds)}
                        </Text>
                      </Box>
                    )}
                    
                        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                      <Box>
                            <Text fontWeight="medium" color={proposedLabelColor} mb={1} fontSize="sm">
                          Proposed
                        </Text>
                        <Text fontSize="sm">
                              {formatDate(selectedProposal?.proposalTimestampSeconds)}
                        </Text>
                      </Box>
                      <Box>
                            <Text fontWeight="medium" color={deadlineLabelColor} mb={1} fontSize="sm">
                          Deadline
                        </Text>
                        <Text fontSize="sm">
                              {formatDate(selectedProposal?.deadlineTimestampSeconds)}
                        </Text>
                      </Box>
                      <Box>
                            <Text fontWeight="medium" color={decidedLabelColor} mb={1} fontSize="sm">
                          Decided
                        </Text>
                        <Text fontSize="sm">
                              {formatDate(selectedProposal?.decidedTimestampSeconds)}
                        </Text>
                      </Box>
                      <Box>
                            <Text fontWeight="medium" color={executedLabelColor} mb={1} fontSize="sm">
                          Executed
                        </Text>
                        <Text fontSize="sm">
                              {formatDate(selectedProposal?.executedTimestampSeconds)}
                        </Text>
                      </Box>
                    </Grid>
                    
                        {selectedProposal?.proposal?.action && (
                      <Box>
                            <Text fontWeight="medium" color={actionLabelColor} mb={1} fontSize="sm">
                          Action
                        </Text>
                        <Code 
                          p={2} 
                          borderRadius="md" 
                          fontSize="xs" 
                          overflowX="auto" 
                          display="block"
                          whiteSpace="pre"
                              bg={preBgColor}
                              color={preTextColor}
                        >
                          {JSON.stringify(selectedProposal.proposal.action, null, 2)}
                        </Code>
                      </Box>
                    )}
                        
                        {/* Remove the old voting section and replace with a message for ineligible users */}
                        {isVotingAllowed(selectedProposal) && getUserVote(selectedProposal).status === "not_eligible" && (
                          <Box mt={4}>
                            <Alert status="info" size="sm">
                              <AlertIcon />
                              Your neuron is not eligible to vote on this proposal.
                            </Alert>
                          </Box>
                        )}
                        
                        {/* Display vote status messages */}
                        {isVotingAllowed(selectedProposal) && (
                          <Box mt={4}>
                            {voteStatus.error && (
                              <Alert status="error" size="sm">
                                <AlertIcon />
                                {voteStatus.error}
                              </Alert>
                            )}
                            
                            {voteStatus.success && (
                              <Alert status="success" size="sm">
                                <AlertIcon />
                                {voteStatus.message}
                              </Alert>
                            )}
                          </Box>
                        )}
                        
                        {!isVotingAllowed(selectedProposal) && (
                          <Box mt={4}>
                            <Alert status="info" size="sm">
                              <AlertIcon />
                              This proposal has passed its voting deadline and can no longer be voted on.
                            </Alert>
                          </Box>
                        )}
                  </VStack>
                </CardBody>
                  </ErrorDisplay>
              </Card>
                
                {/* Replace AI Agent Analysis with component */}
                <AgentAnalysisCard 
                  agentVote={agentVote}
                  agentError={agentError}
                  isLoadingAgent={isLoadingAgent}
                  isReevaluating={isReevaluating}
                  handleReevaluate={handleReevaluate}
                  getAgentVoteBadgeColor={getAgentVoteBadgeColor}
                />
                
                {/* Replace Agent Activity Log with component */}
                <AgentLogsCard logs={agentLogs} />
              </>
            ) : (
              <Card 
                variant="outline" 
                shadow="md" 
                p={6} 
                textAlign="center" 
                color={noProposalColor}
                height="100%"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text>Select a proposal to view details</Text>
              </Card>
            )}
          </GridItem>
        </Grid>
      )}
    </Container>
  );
};

export default Proposals; 