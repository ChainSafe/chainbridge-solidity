/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const NativeAssetHandlerContract = artifacts.require("NativeAssetHandler");

contract('NativeAssetHandler - [Deposit ETH]', async (accounts) => {
    const BN = web3.utils.BN;

    const relayerThreshold = 2;
    const chainID = 1;
    const expectedDepositNonce = 1;
    const depositerAddress = accounts[1];
    const depositAmount = web3.utils.toWei(new BN(1), 'ether');
    const hexDepositAmount = '0xDE0B6B3A7640000';
    
    let BridgeInstance;
    let ERC20MintableInstance;
    let NativeAssetHandlerInstance;
    
    let resourceID;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
        ]);
        
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];
        burnableContractAddresses = []

        NativeAssetHandlerInstance = await NativeAssetHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        await Promise.all([
            BridgeInstance.adminSetHandlerAddress(NativeAssetHandlerInstance.address, resourceID),
            NativeAssetHandlerInstance.depositNative({from: depositerAddress, value: depositAmount})
        ]);
    });

    it('[sanity] depositer has an available balance of depositAmount in NativeAssetHandlerInstance', async () => {
        const depositerBalance = await NativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(depositerBalance.toString(), depositAmount.toString());
    });

    it('Varied recipient address with length 40', async () => {
        const recipientAddress = accounts[0] + accounts[1].substr(2);
        const lenRecipientAddress = 40;
        const expectedDepositRecord = {
            _tokenAddress: ERC20MintableInstance.address,
            _destinationChainID: chainID,
            _resourceID: resourceID,
            _lenDestinationRecipientAddress: lenRecipientAddress,
            _destinationRecipientAddress: recipientAddress,
            _depositer: depositerAddress,
            _amount: depositAmount.toString()
        };
        
        await BridgeInstance.deposit(
            chainID,
            resourceID,
            Helpers.createERCDepositData(
                resourceID,
                hexDepositAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress }
        );

        const depositRecord = await NativeAssetHandlerInstance.getDepositRecord(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, depositRecord));
    });

    it('Varied recipient address with length 32', async () => {
        const recipientAddress = Ethers.utils.keccak256(accounts[0]);
        const lenRecipientAddress = 32;
        const expectedDepositRecord = {
            _tokenAddress: ERC20MintableInstance.address,
            _destinationChainID: chainID,
            _resourceID: resourceID,
            _lenDestinationRecipientAddress: lenRecipientAddress,
            _destinationRecipientAddress: recipientAddress,
            _depositer: depositerAddress,
            _amount: depositAmount.toString()
        };

        await BridgeInstance.deposit(
            chainID,
            resourceID,
            Helpers.createERCDepositData(
                resourceID,
                hexDepositAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress }
        );

        const depositRecord = await NativeAssetHandlerInstance.getDepositRecord(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, depositRecord));
    });
});
