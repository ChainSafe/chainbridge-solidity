#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only

ERC721_HANDLER="0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31"
ERC721_RESOURCE_ID="0x000000000000000000000021605f71845f372A9ed84253d2D024B7B10999f400"
ERC721_CONTRACT="0x21605f71845f372A9ed84253d2D024B7B10999f4"

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