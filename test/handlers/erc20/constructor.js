/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [constructor]', async () => {
    const relayerThreshold = 2;
    const domainID = 1;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let ERC20MintableInstance3;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance2 = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance3 = instance)
        ])

        initialResourceIDs = [];
        burnableContractAddresses = [];

        initialResourceIDs.push(Ethers.utils.hexZeroPad((ERC20MintableInstance1.address + Ethers.utils.hexlify(domainID).substr(2)), 32));
        initialResourceIDs.push(Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(domainID).substr(2)), 32));
        initialResourceIDs.push(Ethers.utils.hexZeroPad((ERC20MintableInstance3.address + Ethers.utils.hexlify(domainID).substr(2)), 32));

        initialContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address, ERC20MintableInstance3.address];
    });

    it('[sanity] contract should be deployed successfully', async () => {
        await TruffleAssert.passes(ERC20HandlerContract.new(BridgeInstance.address));
    });

    it('initialResourceIDs should be parsed correctly and corresponding resourceID mappings should have expected values', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        for (i = 0; i < initialResourceIDs.length; i++) {
            await TruffleAssert.passes(BridgeInstance.adminSetResource(ERC20HandlerInstance.address, initialResourceIDs[i], initialContractAddresses[i]));
        }
        
        for (const resourceID of initialResourceIDs) {
            const tokenAddress = `0x` + resourceID.substr(24,40);
            
            const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID);
            assert.strictEqual(Ethers.utils.getAddress(tokenAddress).toLowerCase(), retrievedTokenAddress.toLowerCase());

            const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(tokenAddress);
            assert.strictEqual(resourceID.toLowerCase(), retrievedResourceID.toLowerCase());
        }
    });
});
