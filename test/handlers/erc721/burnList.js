/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers =require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('ERC721Handler - [Burn ERC721]', async () => {
    const relayerThreshold = 2;
    const chainID = 1;

    let BridgeInstance;
    let ERC721MintableInstance1;
    let ERC721MintableInstance2;
    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance1 = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance2 = instance)
        ])

        resourceID1 = Helpers.createResourceID(ERC721MintableInstance1.address, chainID);
        resourceID2 = Helpers.createResourceID(ERC721MintableInstance2.address, chainID);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC721MintableInstance1.address, ERC721MintableInstance2.address];
        burnableContractAddresses = [ERC721MintableInstance1.address]
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses));
    });

    it('burnableContractAddresses should be marked true in _burnList', async () => {
        const ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC721HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });

    it('ERC721MintableInstance2.address should not be marked true in _burnList', async () => {
        const ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        const isBurnable = await ERC721HandlerInstance._burnList.call(ERC721MintableInstance2.address);
        assert.isFalse(isBurnable, "Contract shouldn't be marked burnable");
    });

    it('ERC721MintableInstance2.address should be marked true in _burnList after setBurnable is called', async () => {
        const ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        await BridgeInstance.adminSetBurnable(ERC721HandlerInstance.address, ERC721MintableInstance2.address);
        const isBurnable = await ERC721HandlerInstance._burnList.call(ERC721MintableInstance2.address);
        assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
    });
});
