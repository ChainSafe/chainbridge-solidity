/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [isWhitelisted]', async () => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const relayerThreshold = 2;
    const chainID = 1;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance2 = instance)
        ])

        initialResourceIDs = [];
        resourceID1 = Ethers.utils.hexZeroPad((ERC20MintableInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        initialResourceIDs.push(resourceID1);
        initialContractAddresses = [ERC20MintableInstance1.address];
        burnableContractAddresses = [];
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses));
    });

    it('initialContractAddress should be whitelisted', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance1.address);
        assert.isTrue(isWhitelisted, "Contract wasn't successfully whitelisted");
    });


    // as we are working with a mandatory whitelist, these tests are currently not necessary
    
    // it('initialContractAddress should not be whitelisted', async () => {
    //     const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses);
    //     const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance1.address);
    //     assert.isFalse(isWhitelisted, "Contract should not have been whitelisted");
    // });

    // it('ERC20MintableInstance2.address should not be whitelisted', async () => {
    //     const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses);
    //     const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance2.address);
    //     assert.isFalse(isWhitelisted, "Contract should not have been whitelisted");
    // });
});
