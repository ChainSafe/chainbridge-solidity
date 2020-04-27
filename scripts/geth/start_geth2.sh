#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only
DATADIR=./gethdata2

# Exit on failure
set -e

# Delete old chain data
rm -rf $DATADIR
# Init genesis
geth init ./scripts/geth/genesis.json --datadir $DATADIR
# Copy keystore
rm -rf $DATADIR/keystore
cp -r ./scripts/geth/keystore $DATADIR
# Start geth with rpc, mining and unlocked accounts

if [[ $QUIET ]]; then
    geth --verbosity 2 \
    --datadir $DATADIR \
    --port 30304 \
    --nodiscover \
    --unlock "0xff93B45308FD417dF303D6515aB04D9e89a750Ca","0x8e0a907331554AF72563Bd8D43051C2E64Be5d35","0x24962717f8fA5BA3b931bACaF9ac03924EB475a0","0x148FfB2074A9e59eD58142822b3eB3fcBffb0cd7","0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485" \
    --password ./scripts/geth/password.txt \
    --ws \
    --wsport 8546 \
    --networkid 5 \
    --wsorigins="*" \
    --targetgaslimit 8000000 \
    --allow-insecure-unlock \
    --mine
else
    geth --datadir $DATADIR \
    --nodiscover \
    --port 30304 \
    --unlock "0xff93B45308FD417dF303D6515aB04D9e89a750Ca","0x8e0a907331554AF72563Bd8D43051C2E64Be5d35","0x24962717f8fA5BA3b931bACaF9ac03924EB475a0","0x148FfB2074A9e59eD58142822b3eB3fcBffb0cd7","0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485" \
    --password ./scripts/geth/password.txt \
    --ws \
    --wsport 8546 \
    --networkid 5 \
    --wsorigins="*" \
    --targetgaslimit 8000000 \
    --allow-insecure-unlock \
    --mine
fi