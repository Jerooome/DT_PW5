import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";
import { delay } from "../utils";


export async function node(
  nodeId: number,
  N: number,
  F: number,
  initialValue: Value,
  isFaulty: boolean,
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());


  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    }
    else {
      res.status(200).send("live");
    }
  });


  
  let state: NodeState = { killed: false, x: initialValue, decided: false, k: 0 };
  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  function handleProposal(k: number, x: Value) {
    if (!proposals.has(k)) {
      proposals.set(k, []);
    }
    proposals.get(k)!.push(x);
  
    // Check if we've reached a majority of proposals
    if (proposals.get(k)!.length >= (N - F)) {
      const count0 = proposals.get(k)!.filter(el => el === 0).length;
      const count1 = proposals.get(k)!.filter(el => el === 1).length;
  
      const consensusValue = count0 > (N / 2) ? 0 : (count1 > (N / 2) ? 1 : "?");

      
      // Broadcast a vote message to all nodes based on the consensus
      broadcastVote(k, consensusValue);
    }
  }
  

  function handleVote(k: number, x: Value) {
    if (!votes.has(k)) {
      votes.set(k, []);
    }
    votes.get(k)!.push(x);
  
    // Check if we've reached a majority of votes
    if (votes.get(k)!.length >= (N - F)) {
      const count0 = votes.get(k)!.filter(el => el === 0).length;
      const count1 = votes.get(k)!.filter(el => el === 1).length;
  
      // Update the node's state based on the majority vote
      if (count0 >= F + 1) {
        state.x = 0;
        state.decided = true;
      } else if (count1 >= F + 1) {
        state.x = 1;
        state.decided = true;
      } else {
        if (count0 + count1 > 0 && count0 > count1) {
          state.x = 0;
        } else if (count0 + count1 > 0 && count0 < count1) {
          state.x = 1;
        } else {
          state.x = Math.random() > 0.5 ? 0 : 1;
        }
        state.k = k + 1;
          
        broadcastProposal(state.k, state.x);
        
        // If there are no votes, don't change the state
      }
    }
  }

  function broadcastVote(k: number, consensusValue: Value) {
    for (let i = 0; i < N; i++) {
      // Exclude the current node from the broadcast
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ k, x: consensusValue, messageType: "vote" })
        });
      
    }
  }
  
  function broadcastProposal(k: number, value: Value) {
    for (let i = 0; i < N; i++) {
      // Exclude the current node from the broadcast
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ k, x: value, messageType: "propose" })
        });
      
    }
  }

  node.post("/message", async (req, res) => {
    if (isFaulty || state.killed) {
      res.status(400).send("Node is faulty or killed");
      return;
    }
    const { k, x, messageType } = req.body;
    
    if (messageType === "propose") {
      handleProposal(k, x);
    } else if (messageType === "vote") {
      handleVote(k, x);
    }
    res.status(200).send("Message received and processed.");
  });



  

  
  // GET /start route to initiate the consensus algorithm
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) {
      await delay(100);
    }
    if (!isFaulty) {
      state.x = initialValue;
      state.decided = false;
      state.k = 1;
      for (let i = 0; i < N; i++) {
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            x: state.x,
            k: state.k,
            messageType: "propose",
          }),
        });
      }
      res.status(200).send("success");
    }
    else {
      state.killed = false,
      state.decided = null;
      state.x = null;
      state.k = null;
      res.status(500).send("The node is faulty.");
    }
  });



  // GET /stop route to halt the consensus algorithm
  node.get("/stop", async (req, res) => {
    state.killed = true;
    state.x = null;
    state.decided = null;
    state.k = null;
    res.status(200).send("Node has been stopped");
  });

  node.get("/getState", (req, res) => {
    res.send(state); //res.json
  });

  // Start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);
    setNodeIsReady(nodeId); // Indicate that the node is ready
  });

  return server;
}
