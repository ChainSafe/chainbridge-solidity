/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const AccessControlSegregatorContract = artifacts.require("AccessControlSegregator");

contract('AccessControlSegregator - [constructor]', async (accounts) => {
    let AccessControlSegregatorInstance;
    let initialFunctions = ["function1", "function2", "function3", "function4"];
    let initialAccessHolders = [accounts[1], accounts[2], accounts[3], accounts[4]];

    beforeEach(async () => {
        AccessControlSegregatorInstance = await AccessControlSegregatorContract.new(initialFunctions, initialAccessHolders);
    });

    it('[sanity] should deploy contract successfully', async () => {
        await TruffleAssert.passes(AccessControlSegregatorContract.new([], []));
    });

    it('should revert if length of functions and accounts array is different', async () => {
        await TruffleAssert.reverts(AccessControlSegregatorContract.new(["1", "2"], [accounts[0]]), "array length should be equal");
    });

    it('should grant deployer grant access rights', async () => {
        assert.isTrue(await AccessControlSegregatorInstance.hasAccess("grantAccess", accounts[0]));
    });

    it('should grant function access specified in params', async () => {
        for( let i = 0; i < initialFunctions.length; i++) {
            assert.isTrue(await AccessControlSegregatorInstance.hasAccess(initialFunctions[i], initialAccessHolders[i]));
        }
    });

    it('should replace grant access of deployer if specified in params', async () => {
        let accessControlInstance = await AccessControlSegregatorContract.new(["grantAccess"], [accounts[1]]);

        assert.isFalse(await accessControlInstance.hasAccess("grantAccess", accounts[0]));
        assert.isTrue(await accessControlInstance.hasAccess("grantAccess", accounts[1]));
    });
  });
