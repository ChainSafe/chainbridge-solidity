#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only
DATADIR=./gethdata

# Exit on failure
set -e

# Delete old chain data
rm -rf $DATADIR
# Init genesis
geth init ./scripts/geth/genesis.json --datadir $DATADIR
# Copy keystore
cp ./scripts/geth/UTC--2019-02-01T20-30-17.296Z--f6016af49e2764fd9ae5188b8cd099dd0ccb86b0 $DATADIR/keystore/
# Start geth with rpc, mining and unlocked account
geth --datadir $DATADIR --rpcport 8545 --unlock 0xF6016af49e2764Fd9AE5188b8CD099dd0CCb86b0 --password ./scripts/geth/password.txt --rpc --networkid 5 --rpccorsdomain="*" --targetgaslimit 8000000 --allow-insecure-unlock --mine
