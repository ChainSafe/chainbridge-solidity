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

contract('ERC20Handler - [setResourceIDAndContractAddress]', async () => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const relayerThreshold = 2;
    const chainID = 1;

    let RelayerInstance;
    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20HandlerInstance;
    let initialResourceIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([], relayerThreshold);
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        ERC20MintableInstance1 = await ERC20MintableContract.new();

        initialResourceIDs = [Ethers.utils.hexZeroPad((ERC20MintableInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32)];
        initialContractAddresses = [ERC20MintableInstance1.address];

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, false);
    });

    it("[sanity] ERC20MintableInstance1's resourceID and contract address should be set correctly", async () => {
        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(initialResourceIDs[0]);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance1.address), retrievedTokenAddress);

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance1.address);
        assert.strictEqual(initialResourceIDs[0].toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('new resourceID and corresponding contract address should be set correctly', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        const secondERC20ResourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32);

        await ERC20HandlerInstance.setResourceIDAndContractAddress(secondERC20ResourceID, ERC20MintableInstance2.address);

        const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(secondERC20ResourceID);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance2.address).toLowerCase(), retrievedTokenAddress.toLowerCase());

        const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance2.address);
        assert.strictEqual(secondERC20ResourceID.toLowerCase(), retrievedResourceID.toLowerCase());
    });

    it('should revert because resourceID should already be set', async () => {
        await TruffleAssert.reverts(ERC20HandlerInstance.setResourceIDAndContractAddress(
            initialResourceIDs[0], ERC20MintableInstance1.address),
            "resourceID already has a corresponding contract address");
    });

    it('should revert because contract address should already be set', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        const secondERC20ResourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32);

        await TruffleAssert.reverts(ERC20HandlerInstance.setResourceIDAndContractAddress(
            secondERC20ResourceID, ERC20MintableInstance1.address),
            'contract address already has corresponding resourceID');
    });
});
