#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only

ERC721_HANDLER="0x21605f71845f372A9ed84253d2D024B7B10999f4"
ERC721_RESOURCE_ID="0x00000000000000000000002B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc0700"
ERC721_CONTRACT="0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07"

set -eux

cb-sol-cli deploy

cb-sol-cli erc20 mint
cb-sol-cli bridge register-resource
cb-sol-cli bridge set-burn
cb-sol-cli erc20 transfer
cb-sol-cli erc20 balance

cb-sol-cli erc721 mint
cb-sol-cli bridge register-resource --handler $ERC721_HANDLER --resourceID $ERC721_RESOURCE_ID --targetContract $ERC721_CONTRACT
cb-sol-cli bridge set-burn --handler $ERC721_HANDLER --tokenContract $ERC721_CONTRACT
cb-sol-cli erc721 transfer

#cb-sol-cli cent transferHash --hash 0x736f796c656e745f677265656e5f69735f70656f706c65
#cb-sol-cli cent getHash --hash 0x736f796c656e745f677265656e5f69735f70656f706c65