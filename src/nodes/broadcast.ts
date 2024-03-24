import { BASE_NODE_PORT } from "../config";

const fetch = require('node-fetch');

async function broadcastMessage(value, phase, totalNodes) {
  // Construct requests for each node based on its nodeId
  const requests = Array.from({ length: totalNodes }, (_, nodeId) => {
    const port = BASE_NODE_PORT + nodeId;
    const url = `http://localhost:${port}/message`;

    // Return a fetch Promise for each node
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, phase }),
    });
  });

  try {
    // Wait for all broadcast requests to complete
    await Promise.all(requests);
    console.log('Broadcast to all nodes was successful.');
  } catch (error) {
    // Handle any errors that occurred during broadcast
    console.error('An error occurred during the broadcast:', error);
  }
}

// Usage example: broadcastMessage('someValue', 1, 10);
// This would send the 'someValue' for 'phase 1' to 10 nodes starting from BASE_NODE_PORT.
