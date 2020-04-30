/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");
const TestContract = artifacts.require("TestContract");

contract('GenericHandler - [deposit]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;
    const expectedDepositNonce = 1;

    const depositerAddress = accounts[1];

    let BridgeInstance;
    let CentrifugeAssetInstance;
    let TestContractInstance;

    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialExecuteFunctionSignatures;
    let GenericHandlerInstance;
    let depositData

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            TestContract.new().then(instance => TestContractInstance = instance)
        ]);

        initialResourceIDs = [
            Helpers.createResourceID(CentrifugeAssetInstance.address, chainID),
            Helpers.createResourceID(TestContractInstance.address, chainID),
        ];
        initialContractAddresses = [CentrifugeAssetInstance.address, TestContractInstance.address];
        initialDepositFunctionSignatures = [
            Helpers.blankFunctionSig,
            Helpers.getFunctionSignature(TestContractInstance, 'noArguments')
        ];
        initialExecuteFunctionSignatures = [
            Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store'),
            Helpers.blankFunctionSig
        ];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address,
            initialResourceIDs,
            initialContractAddresses,
            initialDepositFunctionSignatures,
            initialExecuteFunctionSignatures);
                
        depositData = Helpers.createGenericDepositData(initialResourceIDs[0], '0xdeadbeef');
    });

    it('deposit can be made successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));
    });

    it('depositRecord is created with expected values', async () => {
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[0],
            _depositer: depositerAddress,
            _metaData: '0xdeadbeef'
        };

        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));
    });

    it('noArguments can be called successfully and depositRecord is created with expected values', async () => {
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[1],
            _depositer: depositerAddress,
            _metaData: null
        };

        const depositTx = await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            Helpers.createGenericDepositData(initialResourceIDs[1], null),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(TestContractInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'WasCalled');
    });
});