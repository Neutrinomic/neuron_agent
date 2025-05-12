import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Tabs, 
  TabList, 
  Tab, 
  Box, 
  useColorModeValue,
  IconButton,
  Flex,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  VStack,
  Spinner,
  Text,
  Tooltip,
  InputGroup,
  InputRightElement
} from '@chakra-ui/react';
import { SettingsIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { FiAward } from 'react-icons/fi'; // Using FiAward icon for voting preferences
import { useState, useEffect } from 'react';

// Custom blurred input component for sensitive data
const BlurredInput = ({ value, onChange, placeholder, ariaLabel }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isShowingContent, setIsShowingContent] = useState(false);
  
  return (
    <InputGroup>
      <Input
        type={isShowingContent ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        sx={{
          letterSpacing: isShowingContent ? 'normal' : '0.25em',
          fontFamily: 'monospace',
          '&::placeholder': {
            letterSpacing: 'normal',
            fontFamily: 'system-ui, sans-serif'
          }
        }}
        aria-label={ariaLabel}
      />
      <InputRightElement>
        <IconButton
          aria-label={isShowingContent ? "Hide API key" : "Show API key"}
          h="1.75rem"
          size="sm"
          variant="ghost"
          onClick={() => setIsShowingContent(!isShowingContent)}
          icon={isShowingContent ? <ViewOffIcon /> : <ViewIcon />}
        />
      </InputRightElement>
    </InputGroup>
  );
};

const TabNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const toast = useToast();
  
  // State for settings form
  const [openaiKey, setOpenaiKey] = useState('');
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Fetch settings when the settings modal is opened
  const handleOpenSettings = () => {
    onSettingsOpen();
    fetchSettings();
  };
  
  // Navigate to voting preferences page
  const handleOpenPreferences = () => {
    navigate('/preferences');
  };
  
  // Fetch current settings from the API
  const fetchSettings = async () => {
    setIsSettingsLoading(true);
    
    try {
      // Fetch OpenAI key
      const openaiKeyResponse = await fetch('/api/config?key=OPENAI_KEY');
      const openaiKeyData = await openaiKeyResponse.json();
      console.log('OpenAI key response:', openaiKeyData);
      if (openaiKeyData.status === 'success' && openaiKeyData.value) {
        setOpenaiKey(openaiKeyData.value);
      } else {
        setOpenaiKey(''); // Clear the input if no value is found
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error loading settings',
        description: 'Could not load your current settings.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSettingsLoading(false);
    }
  };
  
  // Save settings to the API
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Save OpenAI key (allow empty string to clear the key)
      console.log('Saving OpenAI key:', openaiKey);
      const openaiResponse = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: 'OPENAI_KEY', value: openaiKey }),
      });
      const openaiData = await openaiResponse.json();
      console.log('OpenAI key save response:', openaiData);
      
      if (!openaiResponse.ok) {
        throw new Error(`Failed to save OpenAI key: ${openaiData.message || 'Unknown error'}`);
      }
      
      toast({
        title: 'Settings saved',
        description: 'Your API key has been updated successfully.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      onSettingsClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error saving settings',
        description: error.message || 'There was an error saving your settings.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Determine which tab is active based on the current path
  const tabIndex = location.pathname.startsWith('/preferences') ? 1 : 0;
  
  // Handle tab change
  const handleTabChange = (index: number) => {
    if (index === 0) {
      navigate('/proposals');
    } else if (index === 1) {
      navigate('/preferences');
    }
  };

  // Use Chakra's color mode values for theming
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box bg={bgColor} p={4} mb={6} borderBottom="1px solid" borderColor={borderColor}>
      <Box maxW="container.xl" mx="auto">
        <Flex justify="space-between" align="center">
          <Tabs index={tabIndex} onChange={handleTabChange} variant="soft-rounded" colorScheme="blue">
            <TabList>
              <Tab>Proposals</Tab>
              <Tab>Preferences</Tab>
            </TabList>
          </Tabs>
          
          <IconButton
            aria-label="API Settings"
            icon={<SettingsIcon />}
            variant="ghost"
            colorScheme="blue"
            onClick={handleOpenSettings}
          />
        </Flex>
      </Box>
      
      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={onSettingsClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex align="center">
              <Text mr={2}>API Settings</Text>
              {isSettingsLoading && <Spinner size="sm" color="blue.500" />}
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {isSettingsLoading ? (
              <VStack py={6}>
                <Spinner size="xl" thickness="4px" color="blue.500" />
                <Text mt={4}>Loading your settings...</Text>
              </VStack>
            ) : (
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>OpenAI API Key</FormLabel>
                  <BlurredInput
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    ariaLabel="OpenAI API Key"
                  />
                  <Text fontSize="xs" mt={1} color="gray.500">
                    Your API key is securely stored and never shared.
                  </Text>
                </FormControl>
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="blue" 
              mr={3} 
              onClick={saveSettings} 
              isLoading={isSaving}
              isDisabled={isSettingsLoading}
            >
              Save
            </Button>
            <Button variant="ghost" onClick={onSettingsClose} isDisabled={isSettingsLoading || isSaving}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TabNavigation; 