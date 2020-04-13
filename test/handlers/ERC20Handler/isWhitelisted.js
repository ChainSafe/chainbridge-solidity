/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20Mintable");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [isWhitelisted]', async () => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const relayerThreshold = 2;
    const chainID = 1;

    let RelayerInstance;
    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let initialResourceIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([], relayerThreshold).then(instance => RelayerInstance = instance),
            ERC20MintableContract.new().then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new().then(instance => ERC20MintableInstance2 = instance)
        ])
        
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);

        initialResourceIDs = [];
        initialResourceIDs.push(AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance1.address]));
        initialContractAddresses = [ERC20MintableInstance1.address];
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, true));
    });

    it('initialContractAddress should be whitelisted', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, true);
        const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance1.address);
        assert.isTrue(isWhitelisted, "Contract wasn't successfully whitelisted");
    });

    it('initialContractAddress should not be whitelisted', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, false);
        const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance1.address);
        assert.isFalse(isWhitelisted, "Contract should not have been whitelisted");
    });

    it('ERC20MintableInstance2.address should not be whitelisted', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, true);
        const isWhitelisted = await ERC20HandlerInstance._contractWhitelist.call(ERC20MintableInstance2.address);
        assert.isFalse(isWhitelisted, "Contract should not have been whitelisted");
    });
});
