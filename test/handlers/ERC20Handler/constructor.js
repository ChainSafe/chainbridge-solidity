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
    let initialTokenIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([], relayerThreshold);
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        ERC20MintableInstance1 = await ERC20MintableContract.new();
        ERC20MintableInstance2 = await ERC20MintableContract.new();
        ERC20MintableInstance3 = await ERC20MintableContract.new();

        initialTokenIDs = [];
        initialTokenIDs.push(AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance1.address]));
        initialTokenIDs.push(AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance2.address]));
        initialTokenIDs.push(AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance3.address]));
        initialContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address, ERC20MintableInstance3.address];
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await ERC20HandlerContract.new(BridgeInstance.address, initialTokenIDs, initialContractAddresses));
    });

    it('initialTokenIDs should be parsed correctly and corresponding tokenID mappings should have expected values', async () => {
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialTokenIDs, initialContractAddresses);
        
        for (const tokenID of initialTokenIDs) {
            const tokenAddress = '0x' + tokenID.substr(90);
            
            const retrievedTokenAddress = await ERC20HandlerInstance._tokenIDToTokenContractAddress.call(tokenID);
            assert.strictEqual(Ethers.utils.getAddress(tokenAddress), retrievedTokenAddress);

            const retrievedTokenID = await ERC20HandlerInstance._tokenContractAddressToTokenID.call(tokenAddress);
            assert.strictEqual(tokenID, retrievedTokenID);
        }
    });
});
