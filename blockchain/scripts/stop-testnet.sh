#!/bin/bash

# Stop Web3Browse Testnet

echo "Stopping testnet nodes..."

if [ -f .testnet.pids ]; then
  PIDS=$(cat .testnet.pids)
  for PID in $PIDS; do
    echo "Stopping node PID $PID"
    kill $PID 2>/dev/null || true
  done

  rm .testnet.pids
  echo "Testnet stopped"
else
  echo "No running testnet found"
fi
