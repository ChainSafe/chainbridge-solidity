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

contract('ERC20Handler - [constructor]', async () => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const relayerThreshold = 2;
    const chainID = 1;

    let RelayerInstance;
    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let ERC20MintableInstance3;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([], relayerThreshold);
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        ERC20MintableInstance1 = await ERC20MintableContract.new();
        ERC20MintableInstance2 = await ERC20MintableContract.new();
        ERC20MintableInstance3 = await ERC20MintableContract.new();

        initialResourceIDs = [];
        burnableContractAddresses = [];

        initialResourceIDs.push(Ethers.utils.hexZeroPad((ERC20MintableInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32));
        initialResourceIDs.push(Ethers.utils.hexZeroPad((ERC20MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32));
        initialResourceIDs.push(Ethers.utils.hexZeroPad((ERC20MintableInstance3.address + Ethers.utils.hexlify(chainID).substr(2)), 32));

        initialContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address, ERC20MintableInstance3.address];
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses));
    });

    it('initialResourceIDs should be parsed correctly and corresponding resourceID mappings should have expected values', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        
        for (const resourceID of initialResourceIDs) {
            const tokenAddress = `0x` + resourceID.substr(24,40);
            
            const retrievedTokenAddress = await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID);
            assert.strictEqual(Ethers.utils.getAddress(tokenAddress).toLowerCase(), retrievedTokenAddress.toLowerCase());

            const retrievedResourceID = await ERC20HandlerInstance._tokenContractAddressToResourceID.call(tokenAddress);
            assert.strictEqual(resourceID.toLowerCase(), retrievedResourceID.toLowerCase());
        }
    });
});
