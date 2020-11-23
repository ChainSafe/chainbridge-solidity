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
const WithDepositerContract = artifacts.require("WithDepositer");

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
    let WithDepositerInstance;

    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialDepositFunctionDepositerOffsets;
    let initialExecuteFunctionSignatures;
    let GenericHandlerInstance;
    let depositData

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            NoArgumentContract.new().then(instance => NoArgumentInstance = instance),
            OneArgumentContract.new().then(instance => OneArgumentInstance = instance),
            TwoArgumentsContract.new().then(instance => TwoArgumentsInstance = instance),
            ThreeArgumentsContract.new().then(instance => ThreeArgumentsInstance = instance),
            WithDepositerContract.new().then(instance => WithDepositerInstance = instance),
        ]);

        initialResourceIDs = [
            Helpers.createResourceID(CentrifugeAssetInstance.address, chainID),
            Helpers.createResourceID(NoArgumentInstance.address, chainID),
            Helpers.createResourceID(OneArgumentInstance.address, chainID),
            Helpers.createResourceID(TwoArgumentsInstance.address, chainID),
            Helpers.createResourceID(ThreeArgumentsInstance.address, chainID),
            Helpers.createResourceID(WithDepositerInstance.address, chainID),
        ];
        initialContractAddresses = [
            CentrifugeAssetInstance.address,
            NoArgumentInstance.address,
            OneArgumentInstance.address,
            TwoArgumentsInstance.address,
            ThreeArgumentsInstance.address,
            WithDepositerInstance.address,
        ];
        initialDepositFunctionSignatures = [
            Helpers.blankFunctionSig,
            Helpers.getFunctionSignature(NoArgumentInstance, 'noArgument'),
            Helpers.getFunctionSignature(OneArgumentInstance, 'oneArgument'),
            Helpers.getFunctionSignature(TwoArgumentsInstance, 'twoArguments'),
            Helpers.getFunctionSignature(ThreeArgumentsInstance, 'threeArguments'),
            Helpers.getFunctionSignature(WithDepositerInstance, 'withDepositer'),
        ];
        initialDepositFunctionDepositerOffsets = [
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            12,
        ];
        initialExecuteFunctionSignatures = [
            Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store'),
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
        ];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address,
            initialResourceIDs,
            initialContractAddresses,
            initialDepositFunctionSignatures,
            initialDepositFunctionDepositerOffsets,
            initialExecuteFunctionSignatures);
        
        await Promise.all([
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[0], initialContractAddresses[0], initialDepositFunctionSignatures[0], initialDepositFunctionDepositerOffsets[0], initialExecuteFunctionSignatures[0]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[1], initialContractAddresses[1], initialDepositFunctionSignatures[1], initialDepositFunctionDepositerOffsets[1], initialExecuteFunctionSignatures[1]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[2], initialContractAddresses[2], initialDepositFunctionSignatures[2], initialDepositFunctionDepositerOffsets[2], initialExecuteFunctionSignatures[2]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[3], initialContractAddresses[3], initialDepositFunctionSignatures[3], initialDepositFunctionDepositerOffsets[3], initialExecuteFunctionSignatures[3]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[4], initialContractAddresses[4], initialDepositFunctionSignatures[4], initialDepositFunctionDepositerOffsets[4], initialExecuteFunctionSignatures[4]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[5], initialContractAddresses[5], initialDepositFunctionSignatures[5], initialDepositFunctionDepositerOffsets[5], initialExecuteFunctionSignatures[5])
        ]);
                
        depositData = Helpers.createGenericDepositData('0xdeadbeef');
    });

    it('deposit can be made successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            initialResourceIDs[0],
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
            initialResourceIDs[0],
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
            initialResourceIDs[1],
            Helpers.createGenericDepositData(null),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(NoArgumentInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'NoArgumentCalled');
    });

    it('oneArgument can be called successfully and depositRecord is created with expected values', async () => {
        const argumentOne = 42;
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[2],
            _depositer: depositerAddress,
            _metaData: argumentOne
        };
        
        const depositTx = await BridgeInstance.deposit(
            chainID,
            initialResourceIDs[2],
            Helpers.createGenericDepositData(Helpers.toHex(argumentOne, 32)),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(OneArgumentInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'OneArgumentCalled', event => event.argumentOne.toNumber() === argumentOne);
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
            initialResourceIDs[3],
            Helpers.createGenericDepositData(encodedMetaData),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(TwoArgumentsInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'TwoArgumentsCalled', event => {
            return JSON.stringify(event.argumentOne), JSON.stringify(argumentOne) &&
            event.argumentTwo === argumentTwo
        });
    });

    it('threeArguments can be called successfully and depositRecord is created with expected values', async () => {
        const argumentOne = 'soylentGreenIsPeople';
        const argumentTwo = -42;
        const argumentThree = true;
        const encodedMetaData = Helpers.abiEncode(['string','int8','bool'], [argumentOne, argumentTwo, argumentThree]);
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[4],
            _depositer: depositerAddress,
            _metaData: encodedMetaData
        };
        
        const depositTx = await BridgeInstance.deposit(
            chainID,
            initialResourceIDs[4],
            Helpers.createGenericDepositData(encodedMetaData),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(ThreeArgumentsInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'ThreeArgumentsCalled', event =>
            event.argumentOne === argumentOne &&
            event.argumentTwo.toNumber() === argumentTwo &&
            event.argumentThree === argumentThree);
    });

    it('withDepositer can be called successfully and depositRecord is created with expected values', async () => {
        const argumentOne = depositerAddress;
        const argumentTwo = 100;
        const encodedMetaData = Helpers.abiEncode(['address','uint256'], [argumentOne, argumentTwo]);
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[5],
            _depositer: depositerAddress,
            _metaData: encodedMetaData
        };

        const depositTx = await BridgeInstance.deposit(
            chainID,
            initialResourceIDs[5],
            Helpers.createGenericDepositData(encodedMetaData),
            { from: depositerAddress }
        );

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, retrievedDepositRecord));

        const internalTx = await TruffleAssert.createTransactionResult(WithDepositerInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'WithDepositerCalled', event =>
            event.argumentOne === argumentOne &&
            event.argumentTwo.toNumber() === argumentTwo);
    });

    it('depositer is enforced in the metadata', async () => {
        const anotherDepositer = accounts[2];
        const argumentOne = anotherDepositer;
        const argumentTwo = 100;
        const encodedMetaData = Helpers.abiEncode(['address','uint256'], [argumentOne, argumentTwo]);

        await TruffleAssert.reverts(BridgeInstance.deposit(
            chainID,
            initialResourceIDs[5],
            Helpers.createGenericDepositData(encodedMetaData),
            { from: depositerAddress }
        ), 'incorrect depositer in the data');
    });
});
