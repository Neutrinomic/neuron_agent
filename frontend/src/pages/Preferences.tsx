import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  useToast,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Card,
  CardBody,
  CardHeader,
  HStack,
  Icon,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Tooltip
} from '@chakra-ui/react';
import { FiCheck, FiSave, FiInfo, FiClock } from 'react-icons/fi';

const Preferences = () => {
  const toast = useToast();
  const [userPrompt, setUserPrompt] = useState('');
  const [scheduleDelay, setScheduleDelay] = useState(60); // Default 60 minutes (1 hour)
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load preferences when the component mounts
    loadPreferences();
  }, []);

  // Load preferences from the API
  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      // Fetch user prompt
      const promptResponse = await fetch('/api/config?key=USER_PROMPT');
      const promptData = await promptResponse.json();
      if (promptData.status === 'success' && promptData.value) {
        setUserPrompt(promptData.value);
      } else {
        setUserPrompt(''); // Clear the input if no value is found
      }

      // Fetch schedule delay
      const delayResponse = await fetch('/api/config?key=VOTE_SCHEDULE_DELAY');
      const delayData = await delayResponse.json();
      if (delayData.status === 'success' && delayData.value) {
        // Convert from seconds to minutes for the slider
        setScheduleDelay(Math.round(parseInt(delayData.value) / 60));
      } else {
        setScheduleDelay(60); // Default to 60 minutes (1 hour)
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: 'Error loading preferences',
        description: 'Could not load your current preferences.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save preferences to the API
  const savePreferences = async () => {
    setIsSaving(true);
    try {
      // Save user prompt
      const promptResponse = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: 'USER_PROMPT', value: userPrompt }),
      });
      
      if (!promptResponse.ok) {
        const promptData = await promptResponse.json();
        throw new Error(`Failed to save user prompt: ${promptData.message || 'Unknown error'}`);
      }

      // Save schedule delay (convert from minutes to seconds for storage)
      const delayResponse = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: 'VOTE_SCHEDULE_DELAY', value: String(scheduleDelay * 60) }),
      });
      
      if (!delayResponse.ok) {
        const delayData = await delayResponse.json();
        throw new Error(`Failed to save schedule delay: ${delayData.message || 'Unknown error'}`);
      }

      toast({
        title: 'Preferences Saved',
        description: 'Your voting preferences have been updated successfully.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error saving preferences',
        description: error.message || 'There was an error saving your preferences.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Format the delay time for display
  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (minutes === 60) {
      return '1 hour';
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} minute${mins > 1 ? 's' : ''}` : ''}`;
    } else { // 24 hours or more
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return `${days} day${days > 1 ? 's' : ''}${hours > 0 ? ` ${hours} hour${hours > 1 ? 's' : ''}` : ''}`;
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      {isLoading ? (
        <VStack spacing={8} py={12}>
          <Spinner size="xl" thickness="4px" color="blue.500" />
          <Text>Loading your preferences...</Text>
        </VStack>
      ) : (
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl">Voting Preferences</Heading>
          
          <Alert status="info" variant="subtle" borderRadius="md">
            <AlertIcon as={FiInfo} />
            <Box>
              <AlertTitle>Configure AI Analysis</AlertTitle>
              <AlertDescription>
                These settings determine how the AI analyzes and votes on proposals. 
              </AlertDescription>
            </Box>
          </Alert>

          <Card>
            <CardHeader>
              <Heading size="md">AI Voting Instructions</Heading>
              <Text mt={2} fontSize="sm" color="gray.500">
                This text is included directly in the AI's prompt to guide its decision-making process.
              </Text>
            </CardHeader>
            <CardBody>
              <FormControl>
                <FormLabel>AI Voting Instructions</FormLabel>
                <Textarea
                  placeholder="Describe your voting preferences and criteria for the AI assistant..."
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  size="lg"
                  minH="600px"
                />
                <Text fontSize="sm" mt={2} color="gray.500">
                  Specify how the AI should evaluate proposals. Consider factors like technical implications, security risks, governance precedents, economic impacts, and alignment with the Internet Computer's vision.
                </Text>
              </FormControl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Heading size="md">Vote Scheduling Delay</Heading>
              <Text mt={2} fontSize="sm" color="gray.500">
                Set how long to wait before executing the vote after the AI makes its recommendation.
              </Text>
            </CardHeader>
            <CardBody>
              <FormControl>
                <FormLabel>Delay Time: {formatTime(scheduleDelay)}</FormLabel>
                <Box pt={6} pb={2}>
                  <Slider
                    min={1}
                    max={2880} // 48 hours in minutes
                    step={1}
                    value={scheduleDelay}
                    onChange={(val) => setScheduleDelay(val)}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <SliderMark value={1} mt={2} ml={-2.5} fontSize="sm">
                      1m
                    </SliderMark>
                    <SliderMark value={60} mt={2} ml={-2.5} fontSize="sm">
                      1h
                    </SliderMark>
                    <SliderMark value={1440} mt={2} ml={-2.5} fontSize="sm">
                      24h
                    </SliderMark>
                    <SliderMark value={2880} mt={2} ml={-2.5} fontSize="sm">
                      48h
                    </SliderMark>
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <Tooltip
                      hasArrow
                      bg="blue.500"
                      color="white"
                      placement="top"
                      isOpen={showTooltip}
                      label={formatTime(scheduleDelay)}
                    >
                      <SliderThumb boxSize={6}>
                        <Icon as={FiClock} color="blue.500" />
                      </SliderThumb>
                    </Tooltip>
                  </Slider>
                </Box>
                <Text fontSize="sm" mt={4} color="gray.500">
                  A longer delay gives you more time to review AI decisions before votes are cast, while a shorter delay allows for more timely voting on urgent proposals.
                </Text>
              </FormControl>
            </CardBody>
          </Card>

          <HStack justifyContent="flex-end">
            <Button
              colorScheme="green"
              size="lg"
              onClick={savePreferences}
              isLoading={isSaving}
              leftIcon={<Icon as={FiSave} />}
            >
              Save Preferences
            </Button>
          </HStack>
        </VStack>
      )}
    </Container>
  );
};

export default Preferences; 