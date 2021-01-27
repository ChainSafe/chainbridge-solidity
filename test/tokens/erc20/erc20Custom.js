/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const { it } = require('ethers/wordlists');

const ERC20CustomContract = artifacts.require("ERC20Custom");

contract('ERC20Custom - [ERC20]', async () => {

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC20CustomContract.new("token", "TOK", 18));
    });
    
    it('Decimals can be modified', async () => {
        const ERC20Instance = await ERC20CustomContract.new("token", "TOK", 10);
        const decimals = await ERC20Instance.decimals.call();
        assert.isTrue(decimals == 10, "Contract wasn't successfully marked burnable");
    });
});