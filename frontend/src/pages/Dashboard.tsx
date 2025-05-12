import { useState, useEffect } from 'react';
import { Box, Text, Heading, Spinner, Code, VStack } from '@chakra-ui/react';
import { fetchStatus, StatusResponse } from '../services/api';

const Dashboard = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Slightly transparent background for card-like elements
  const boxBg = 'rgba(30, 30, 30, 0.7)';
  const borderColor = 'rgba(255, 255, 255, 0.1)';

  useEffect(() => {
    const getStatus = async () => {
      try {
        setLoading(true);
        const data = await fetchStatus();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    getStatus();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" width="100%" bg="transparent">
        <Spinner size="xl" color="blue.400" thickness="4px" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        p={8} 
        maxWidth="800px" 
        margin="0 auto" 
        color="red.400"
        bg={boxBg}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
        mt={10}
      >
        <Heading mb={4}>Error</Heading>
        <Text>{error}</Text>
      </Box>
    );
  }

  return (
    <Box p={8} maxWidth="800px" margin="0 auto" mt={10} bg="transparent">
      <Heading mb={6} color="gray.100" textAlign="center">Oscillum Status</Heading>
      
      <Box 
        p={6} 
        bg={boxBg}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
        boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
      >
        <VStack spacing={6} align="stretch">
          <Box>
            <Text color="gray.400" mb={1}>Status:</Text>
            <Text color="green.400" fontSize="2xl">{status?.status || 'Unknown'}</Text>
          </Box>
          
          <Box>
            <Text color="gray.400" mb={1}>Principal ID:</Text>
            <Code p={2} borderRadius="md" bg="gray.800" color="blue.300" fontSize="sm" width="100%" overflowX="auto">
              {status?.principal || 'Not available'}
            </Code>
          </Box>
          
          <Box>
            <Text color="gray.400" mb={1}>User Preference:</Text>
            <Text color="white" fontSize="md">{status?.userPreference || 'Not set'}</Text>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
};

export default Dashboard; 