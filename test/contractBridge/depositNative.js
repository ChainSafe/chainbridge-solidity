/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const NativeAssetHandlerContract = artifacts.require("NativeAssetHandler");

contract('Bridge - [deposit - Native Asset]', async (accounts) => {
    const BN = web3.utils.BN;

    const originChainID = 1;
    const destinationChainID = 2;
    const relayerThreshold = 0;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const depositAmount = web3.utils.toWei(new BN(1), 'ether');
    const hexDepositAmount = '0xDE0B6B3A7640000';
    const expectedDepositNonce = 1;
    
    let BridgeInstance;
    let ERC20MintableInstance;
    let NativeAssetHandlerInstance;
    let depositData;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
            BridgeInstance = await BridgeContract.new(originChainID, [], relayerThreshold, 0)
        ]);
        
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originChainID);
        initialResourceIDs = [];
        initialContractAddresses = [];
        burnableContractAddresses = [];

        NativeAssetHandlerInstance = await NativeAssetHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        await Promise.all([
            BridgeInstance.adminSetResource(NativeAssetHandlerInstance.address, resourceID, ERC20MintableInstance.address),
            NativeAssetHandlerInstance.depositNative({from: depositerAddress, value: depositAmount}),
        ]);

        depositData = Helpers.createERCDepositData(
            resourceID,
            hexDepositAmount,
            20,
            recipientAddress);
    });

    it('[sanity] depositer has an available balance of depositAmount in NativeAssetHandlerInstance', async () => {
        const balance = await NativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), depositAmount.toString());
    });

    it('ERC20 deposit can be made', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        ));
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC20 can be deposited with correct balances', async () => {
        let balance;

        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        balance = await NativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), '0');

        balance = await NativeAssetHandlerInstance._lockedBalances.call(depositerAddress);
        assert.equal(balance.toString(), depositAmount.toString());
    });

    it('depositRecord is created with expected depositNonce and correct value', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        const depositRecord = await BridgeInstance._depositRecords.call(destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositRecord, depositData.toLowerCase(), "Stored depositRecord does not match original depositData");
    });

    it('Deposit event is fired with expected value', async () => {
        let depositTx = await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        await NativeAssetHandlerInstance.depositNative({from: depositerAddress, value: depositAmount});

        depositTx = await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce + 1
        });
    });
});