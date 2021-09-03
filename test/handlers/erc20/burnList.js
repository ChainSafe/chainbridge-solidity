/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Burn ERC20]', async () => {
    const relayerThreshold = 2;
    const chainID = 1;

    let RelayerInstance;
    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance2 = instance)
        ]);

        resourceID1 = Ethers.utils.hexZeroPad((ERC20MintableInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        resourceID2 = Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address];
        burnableContractAddresses = [ERC20MintableInstance1.address]
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses));
    });

    it('burnableContractAddresses should be marked true in _burnList', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC20HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });

    it('ERC20MintableInstance2.address should not be marked true in _burnList', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        const isBurnable = await ERC20HandlerInstance._burnList.call(ERC20MintableInstance2.address);
        assert.isFalse(isBurnable, "Contract shouldn't be marked burnable");
    });

    it('ERC20MintableInstance2.address should be marked true in _burnList after setBurnable is called', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance2.address);
        const isBurnable = await ERC20HandlerInstance._burnList.call(ERC20MintableInstance2.address);
        assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
    });
});
