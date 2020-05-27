#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only

ERC721_HANDLER="0x21605f71845f372A9ed84253d2D024B7B10999f4"
ERC721_RESOURCE_ID="0x00000000000000000000002B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc0700"
ERC721_CONTRACT="0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07"

GAS_LIMIT=6721975
GAS_PRICE=20000000000

set -eux

cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE deploy

cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc20 mint
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc20 add-minter
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE bridge register-resource
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE bridge set-burn
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc20 transfer
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc20 balance

cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc721 mint
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc721 add-minter
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE bridge register-resource --handler $ERC721_HANDLER --resourceID $ERC721_RESOURCE_ID --targetContract $ERC721_CONTRACT
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE bridge set-burn --handler $ERC721_HANDLER --tokenContract $ERC721_CONTRACT
cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE erc721 transfer

cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE bridge register-generic-resource --execute "store(bytes32)" --hash

cb-sol-cli --gas-limit $GAS_LIMIT --gas-price $GAS_PRICE cent getHash