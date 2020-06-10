#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only

ERC721_HANDLER="0x3f709398808af36ADBA86ACC617FeB7F5B7B193E"
ERC721_RESOURCE_ID="0x0000000000000000000000d7E33e1bbf65dC001A0Eb1552613106CD7e40C3100"
ERC721_CONTRACT="0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31"

GAS_LIMIT=6721975
GAS_PRICE=20000000000

NEW_RELAYER="0x8cED5ad0d8dA4Ec211C17355Ed3DBFEC4Cf0E5b9"

set -eux

cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE deploy --all

cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc20 mint
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc20 add-minter
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE bridge register-resource
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE bridge set-burn
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc20 approve
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc20 deposit
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc20 balance

cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc721 mint --id 0x1
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc721 add-minter
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE bridge register-resource --handler $ERC721_HANDLER --resourceId $ERC721_RESOURCE_ID --targetContract $ERC721_CONTRACT
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc721 approve --id 0x1
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE bridge set-burn --handler $ERC721_HANDLER --tokenContract $ERC721_CONTRACT
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE erc721 deposit --id 0x1

cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE bridge register-generic-resource --execute "store(bytes32)" --hash
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE cent getHash

cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin is-relayer
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin add-relayer --relayer $NEW_RELAYER
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin remove-relayer --relayer $NEW_RELAYER
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin set-threshold --threshold 3
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin pause
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin unpause
cb-sol-cli --gasLimit $GAS_LIMIT --gasPrice $GAS_PRICE admin set-fee --fee 1

