/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const AccessControlSegregatorContract = artifacts.require("AccessControlSegregator");

contract('AccessControlSegregator - [grant access]', async (accounts) => {
    let AccessControlSegregatorInstance;

    const functionSignature = "0x29a71964";

    beforeEach(async () => {
        AccessControlSegregatorInstance = await AccessControlSegregatorContract.new([], []);
    });

    it('hasAccess should return false if access not granted', async () => {
        assert.isFalse(await AccessControlSegregatorInstance.hasAccess(functionSignature, accounts[2]));
    });

    it('should revert if sender doesn\'t have  grant access rights', async () => {
        await TruffleAssert.reverts(AccessControlSegregatorInstance.grantAccess(functionSignature, accounts[2], { from: accounts[1]}), "sender doesn't have grant access rights");
    });

    it('should successfully grant access to a function', async () => {
        await TruffleAssert.passes(AccessControlSegregatorInstance.grantAccess(functionSignature, accounts[2]));

        assert.isTrue(await AccessControlSegregatorInstance.hasAccess(functionSignature, accounts[2]));
    });

    it('should successfully regrant access', async () => {
        await TruffleAssert.passes(AccessControlSegregatorInstance.grantAccess(functionSignature, accounts[2]));
        assert.isTrue(await AccessControlSegregatorInstance.hasAccess(functionSignature, accounts[2]));

        await TruffleAssert.passes(AccessControlSegregatorInstance.grantAccess(functionSignature, accounts[3]));
        assert.isTrue(await AccessControlSegregatorInstance.hasAccess(functionSignature, accounts[3]));
    });
  });
