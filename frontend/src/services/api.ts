/**
 * API Service for communicating with the backend
 */

const API_BASE_URL = ''; // Empty string for relative URLs

export interface StatusResponse {
  status: string;
  principal: string;
  userPreference: string;
}

export interface Neuron {
  id: string;
  stake: string;
  dissolveDelay: string;
}

export interface NeuronsResponse {
  neurons: Neuron[];
}

/**
 * Fetch application status including principal ID
 */
export async function fetchStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/status`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch status');
  }
  
  return response.json();
}

/**
 * Fetch list of neurons
 */
export async function fetchNeurons(): Promise<NeuronsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/neurons`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch neurons');
  }
  
  return response.json();
}

/**
 * Update configuration
 */
export async function updateConfig(key: string, value: any): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, value }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update configuration');
  }
  
  return response.json();
} 