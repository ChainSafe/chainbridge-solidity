/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");
const NoArgumentContract = artifacts.require("NoArgument");
const OneArgumentContract = artifacts.require("OneArgument");
const TwoArgumentsContract = artifacts.require("TwoArguments");
const ThreeArgumentsContract = artifacts.require("ThreeArguments");

contract('GenericHandler - [deposit]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;
    const expectedDepositNonce = 1;

    const depositerAddress = accounts[1];

    let BridgeInstance;
    let CentrifugeAssetInstance;
    let NoArgumentInstance;
    let OneArgumentInstance;
    let TwoArgumentsInstance;
    let ThreeArgumentsInstance;

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
            NoArgumentContract.new().then(instance => NoArgumentInstance = instance),
            OneArgumentContract.new().then(instance => OneArgumentInstance = instance),
            TwoArgumentsContract.new().then(instance => TwoArgumentsInstance = instance),
            ThreeArgumentsContract.new().then(instance => ThreeArgumentsInstance = instance)
        ]);

        initialResourceIDs = [
            Helpers.createResourceID(CentrifugeAssetInstance.address, chainID),
            Helpers.createResourceID(NoArgumentInstance.address, chainID),
            Helpers.createResourceID(OneArgumentInstance.address, chainID),
            Helpers.createResourceID(TwoArgumentsInstance.address, chainID),
            Helpers.createResourceID(ThreeArgumentsInstance.address, chainID),
        ];
        initialContractAddresses = [
            CentrifugeAssetInstance.address,
            NoArgumentInstance.address,
            OneArgumentInstance.address,
            TwoArgumentsInstance.address,
            ThreeArgumentsInstance.address];
        initialDepositFunctionSignatures = [
            Helpers.blankFunctionSig,
            Helpers.getFunctionSignature(NoArgumentInstance, 'noArgument'),
            Helpers.getFunctionSignature(OneArgumentInstance, 'oneArgument'),
            Helpers.getFunctionSignature(TwoArgumentsInstance, 'twoArguments'),
            Helpers.getFunctionSignature(ThreeArgumentsInstance, 'threeArguments')
        ];
        initialExecuteFunctionSignatures = [
            Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store'),
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
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

    it('noArgument can be called successfully and depositRecord is created with expected values', async () => {
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

        const internalTx = await TruffleAssert.createTransactionResult(NoArgumentInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'NoArgumentCalled');
    });

    it('oneArgument can be called successfully and depositRecord is created with expected values', async () => {
        const oneArgument = 42;
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[2],
            _depositer: depositerAddress,
            _metaData: oneArgument
        };
        
        const depositTx = await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            Helpers.createGenericDepositData(initialResourceIDs[2], Helpers.toHex(oneArgument, 32)),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(OneArgumentInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'OneArgumentCalled');
    });

    it('twoArguments can be called successfully and depositRecord is created with expected values', async () => {
        const argumentOne = [NoArgumentInstance.address, OneArgumentInstance.address, TwoArgumentsInstance.address];
        const argumentTwo = initialDepositFunctionSignatures[3];
        const encodedMetaData = Helpers.abiEncode(['address[]','bytes4'], [argumentOne, argumentTwo]);
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[3],
            _depositer: depositerAddress,
            _metaData: encodedMetaData
        };
        
        const depositTx = await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            Helpers.createGenericDepositData(initialResourceIDs[3], encodedMetaData),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(TwoArgumentsInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'TwoArgumentsCalled');
    });

    it('threeArguments can be called successfully and depositRecord is created with expected values', async () => {
        const argumentOne = 'soylentGreenIsPeople';
        const argumentTwo = -42;
        const argumentThree = false;
        const encodedMetaData = Helpers.abiEncode(['string','int256','bool'], [argumentOne, argumentTwo, argumentThree]);
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[4],
            _depositer: depositerAddress,
            _metaData: encodedMetaData
        };
        
        const depositTx = await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            Helpers.createGenericDepositData(initialResourceIDs[4], encodedMetaData),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(ThreeArgumentsInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'ThreeArgumentsCalled');
    });
});