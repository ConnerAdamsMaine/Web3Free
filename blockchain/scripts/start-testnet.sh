#!/bin/bash

# Start Web3Browse Testnet
# Starts multiple nodes for local testing

echo "Starting Web3Browse Testnet..."

# Create data directories
mkdir -p data/node1 data/node2 data/node3 logs

# Start bootstrap node (Node 1)
echo "Starting bootstrap node..."
API_PORT=3001 P2P_PORT=9000 P2P_WS_PORT=9001 DATA_DIR=./data/node1 \
  node core/index.js > logs/node1.log 2>&1 &
NODE1_PID=$!

# Wait for bootstrap node to start
sleep 3

# Get bootstrap node peer ID (would need to extract from logs in real implementation)
BOOTSTRAP_PEER="/ip4/127.0.0.1/tcp/9000"

# Start Node 2
echo "Starting node 2..."
API_PORT=3002 P2P_PORT=9002 P2P_WS_PORT=9003 DATA_DIR=./data/node2 \
  BOOTSTRAP_PEERS=$BOOTSTRAP_PEER \
  node core/index.js > logs/node2.log 2>&1 &
NODE2_PID=$!

# Start Node 3
echo "Starting node 3..."
API_PORT=3003 P2P_PORT=9004 P2P_WS_PORT=9005 DATA_DIR=./data/node3 \
  BOOTSTRAP_PEERS=$BOOTSTRAP_PEER \
  node core/index.js > logs/node3.log 2>&1 &
NODE3_PID=$!

echo "Testnet started!"
echo "Node 1 API: http://localhost:3001"
echo "Node 2 API: http://localhost:3002"
echo "Node 3 API: http://localhost:3003"
echo ""
echo "PIDs: $NODE1_PID $NODE2_PID $NODE3_PID"
echo ""
echo "To stop: ./scripts/stop-testnet.sh"

# Save PIDs for cleanup
echo "$NODE1_PID $NODE2_PID $NODE3_PID" > .testnet.pids
