/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [setResourceIDAndContractAddress]', async () => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const relayerThreshold = 2;
    const chainID = 1;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20HandlerInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(chainID, [], relayerThreshold, 0, 100);
        ERC20MintableInstance1 = await ERC20MintableContract.new("token", "TOK");

        initialResourceIDs = [Ethers.utils.hexZeroPad((ERC20MintableInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32)];
        initialContractAddresses = [ERC20MintableInstance1.address];
        burnableContractAddresses = [];

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
    });

    it("[sanity] ERC20MintableInstance1's resourceID and contract address should be set correctly", async () => {
        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(initialResourceIDs[0]);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance1.address), retrievedTokenAddress);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance1.address);
        assert.strictEqual(initialResourceIDs[0].toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('new resourceID and corresponding contract address should be set correctly', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new("token", "TOK");
        const secondERC20ResourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, secondERC20ResourceID, ERC20MintableInstance2.address);

        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(secondERC20ResourceID);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance2.address).toLowerCase(), retrievedTokenAddress.toLowerCase());

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance2.address);
        assert.strictEqual(secondERC20ResourceID.toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('existing resourceID should be updated correctly with new token contract address', async () => {
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, initialResourceIDs[0], ERC20MintableInstance1.address);

        const ERC20MintableInstance2 = await ERC20MintableContract.new("token", "TOK");
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, initialResourceIDs[0], ERC20MintableInstance2.address);

        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(initialResourceIDs[0]);
        assert.strictEqual(ERC20MintableInstance2.address, retrievedTokenAddress);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance2.address);
        assert.strictEqual(initialResourceIDs[0].toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('existing resourceID should be updated correctly with new handler address', async () => {
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, initialResourceIDs[0], ERC20MintableInstance1.address);

        const ERC20MintableInstance2 = await ERC20MintableContract.new("token", "TOK");
        const secondERC20ResourceID = [Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32)];
        ERC20HandlerInstance2 = await ERC20HandlerContract.new(BridgeInstance.address, secondERC20ResourceID, [ERC20MintableInstance2.address], burnableContractAddresses);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance2.address, initialResourceIDs[0], ERC20MintableInstance2.address);

        const bridgeHandlerAddress = await BridgeInstance._resourceIDToHandlerAddress.call(initialResourceIDs[0]);
        assert.strictEqual(bridgeHandlerAddress.toLowerCase(), ERC20HandlerInstance2.address.toLowerCase());
    });

    it('existing resourceID should be replaced by new resourceID in handler', async () => {
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, initialResourceIDs[0], ERC20MintableInstance1.address);

        const ERC20MintableInstance2 = await ERC20MintableContract.new("token", "TOK");
        const secondERC20ResourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, secondERC20ResourceID, ERC20MintableInstance1.address);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance1.address);
        assert.strictEqual(secondERC20ResourceID.toLowerCase(), retrievedResourceID.toLowerCase());

        const retrievedContractAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(secondERC20ResourceID);
        assert.strictEqual(retrievedContractAddress.toLowerCase(), ERC20MintableInstance1.address.toLowerCase());
    });
});
