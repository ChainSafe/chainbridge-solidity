#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only


set -eux

cb-sol-cli deploy
cb-sol-cli erc20 mint
cb-sol-cli erc20 register-resource
cb-sol-cli erc20 set-burn
cb-sol-cli erc20 transfer
cb-sol-cli erc20 balance
cb-sol-cli erc721 mint
cb-sol-cli erc721 register-resource
cb-sol-cli erc721 set-burn
cb-sol-cli erc721 transfer
# cb-sol-cli cent transferHash --hash 0x736f796c656e745f677265656e5f69735f70656f706c65
# cb-sol-cli cent getHash --hash 0x736f796c656e745f677265656e5f69735f70656f706c65