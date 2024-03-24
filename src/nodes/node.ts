import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";



export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let currentRound = 0;
  let value = initialValue;
  let decided = false;
  let receivedValues = {};

  const BASE_NODE_PORT = 3000; // Assuming this is defined elsewhere in your config

  // Function to broadcast messages to other nodes
  const broadcastMessage = async (value: any, phase: number) => {
    for (let i = 0; i < N; i++) {
      if (i === nodeId) continue; // Skip sending to self
      const port = BASE_NODE_PORT + i;
      const url = `http://localhost:${port}/message`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: nodeId, value, phase }),
      }).catch(err => console.error(`Error broadcasting to node ${i}:`, err));
    }
  };











  // TODO implement this
  // this route allows retrieving the current status of the node
  // node.get("/status", (req, res) => {});
  node.get("/status", (req, res) => {
  if (isFaulty) {
    res.status(500).send('faulty');
  } else {
    res.status(200).send('live');
  }
});

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  // node.post("/message", (req, res) => {});
  node.post('/message', (req, res) => {
    if (decided || isFaulty) {
      return res.status(200).send('Node has decided or is faulty');
    }
    const { senderId, value, phase } = req.body;
    // Implement logic to process received message
    // Similar to processMessage and checkDecision logic outlined earlier
    return res.send('Message processed');
  });


  // TODO implement this
  // this route is used to start the consensus algorithm
  // node.get("/start", async (req, res) => {});
  node.get('/start', async (req, res) => {
    if (!isFaulty && nodesAreReady()) {
      currentRound = 1;
      await broadcastMessage(value, currentRound);
      res.send('Consensus process started');
    } else {
      res.status(500).send('Node is faulty or nodes not ready');
    }
  });


  // TODO implement this
  // this route is used to stop the consensus algorithm
  // node.get("/stop", async (req, res) => {});
  node.get('/stop', (req, res) => {
  // Code to stop the consensus process, such as clearing timeouts or intervals
  res.status(200).send('Node has stopped the consensus process.');
});

  // TODO implement this
  // get the current state of a node
  // node.get("/getState", (req, res) => {});

  type NodeState = {
  killed: boolean; // this is used to know if the node was stopped by the /stop route. It's important for the unit tests but not very relevant for the Ben-Or implementation
  x: 0 | 1 | "?" | null; // the current consensus value
  decided: boolean | null; // used to know if the node reached finality
  k: number | null; // current step of the node
  };

  node.get("/getState", (req, res) => {
  const state: NodeState = {
    killed: false, // This should be updated based on your application's logic
    x: isFaulty ? "?" : initialValue, // Use "?" or another valid Value to indicate an unknown state
    decided: isFaulty ? false : false, // Set an appropriate boolean value
    k: isFaulty ? null : 0, // Adjust according to your logic
  };
  res.status(200).json(state);
});

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}
