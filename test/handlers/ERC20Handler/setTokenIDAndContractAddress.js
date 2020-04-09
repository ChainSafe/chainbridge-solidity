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

contract('ERC20Handler - [setTokenIDAndContractAddress]', async () => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const relayerThreshold = 2;
    const chainID = 1;

    let RelayerInstance;
    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20HandlerInstance;
    let initialTokenIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([], relayerThreshold);
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        ERC20MintableInstance1 = await ERC20MintableContract.new();

        initialTokenIDs = [AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance1.address])];
        initialContractAddresses = [ERC20MintableInstance1.address];

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialTokenIDs, initialContractAddresses);
    });

    it("[sanity] ERC20MintableInstance1's tokenID and contract address should be set correctly", async () => {
        const retrievedTokenAddress = await ERC20HandlerInstance._tokenIDToTokenContractAddress.call(initialTokenIDs[0]);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance1.address), retrievedTokenAddress);

        const retrievedTokenID = await ERC20HandlerInstance._tokenContractAddressToTokenID.call(ERC20MintableInstance1.address);
        assert.strictEqual(initialTokenIDs[0], retrievedTokenID);
    });

    it('new tokenID and corresponding contract address should be set correctly', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        const secondERC20TokenID = AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance2.address]);

        await ERC20HandlerInstance.setTokenIDAndContractAddress(secondERC20TokenID, ERC20MintableInstance2.address);

        const retrievedTokenAddress = await ERC20HandlerInstance._tokenIDToTokenContractAddress.call(secondERC20TokenID);
        assert.strictEqual(Ethers.utils.getAddress(ERC20MintableInstance2.address), retrievedTokenAddress);

        const retrievedTokenID = await ERC20HandlerInstance._tokenContractAddressToTokenID.call(ERC20MintableInstance2.address);
        assert.strictEqual(secondERC20TokenID, retrievedTokenID);
    });

    it('should revert because tokenID should already be set', async () => {
        await TruffleAssert.reverts(ERC20HandlerInstance.setTokenIDAndContractAddress(
            initialTokenIDs[0], ERC20MintableInstance1.address),
            "tokenID already has a corresponding contract address");
    });

    it('should revert because contract address should already be set', async () => {
        const ERC20MintableInstance2 = await ERC20MintableContract.new();
        const secondERC20TokenID = AbiCoder.encode(['uint256', 'address'], [chainID, ERC20MintableInstance2.address]);

        await TruffleAssert.reverts(ERC20HandlerInstance.setTokenIDAndContractAddress(
            secondERC20TokenID, ERC20MintableInstance1.address),
            'contract address already has corresponding tokenID');
    });
});
