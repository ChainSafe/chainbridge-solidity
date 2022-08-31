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
const NoArgumentContract = artifacts.require("NoArgument");
const OneArgumentContract = artifacts.require("OneArgument");
const TwoArgumentsContract = artifacts.require("TwoArguments");
const ThreeArgumentsContract = artifacts.require("ThreeArguments");
const WithDepositorContract = artifacts.require("WithDepositor");
const ReturnDataContract = artifacts.require("ReturnData");
contract('GenericHandler - [deposit]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const expectedDepositNonce = 1;

    const depositorAddress = accounts[1];

    const feeData = '0x';

    let BridgeInstance;
    let CentrifugeAssetInstance;
    let NoArgumentInstance;
    let OneArgumentInstance;
    let TwoArgumentsInstance;
    let ThreeArgumentsInstance;
    let WithDepositorInstance;
    let ReturnDataInstance;

    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialDepositFunctionDepositorOffsets;
    let initialExecuteFunctionSignatures;
    let GenericHandlerInstance;
    let depositData

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(originDomainID, accounts[0]),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            NoArgumentContract.new().then(instance => NoArgumentInstance = instance),
            OneArgumentContract.new().then(instance => OneArgumentInstance = instance),
            TwoArgumentsContract.new().then(instance => TwoArgumentsInstance = instance),
            ThreeArgumentsContract.new().then(instance => ThreeArgumentsInstance = instance),
            WithDepositorContract.new().then(instance => WithDepositorInstance = instance),
            ReturnDataContract.new().then(instance => ReturnDataInstance = instance),
        ]);
        initialResourceIDs = [
            Helpers.createResourceID(CentrifugeAssetInstance.address, originDomainID),
            Helpers.createResourceID(NoArgumentInstance.address, originDomainID),
            Helpers.createResourceID(OneArgumentInstance.address, originDomainID),
            Helpers.createResourceID(TwoArgumentsInstance.address, originDomainID),
            Helpers.createResourceID(ThreeArgumentsInstance.address, originDomainID),
            Helpers.createResourceID(WithDepositorInstance.address, originDomainID),
            Helpers.createResourceID(ReturnDataInstance.address, originDomainID),
        ];
        initialContractAddresses = [
            CentrifugeAssetInstance.address,
            NoArgumentInstance.address,
            OneArgumentInstance.address,
            TwoArgumentsInstance.address,
            ThreeArgumentsInstance.address,
            WithDepositorInstance.address,
            ReturnDataInstance.address,
        ];
        initialDepositFunctionSignatures = [
            Helpers.blankFunctionSig,
            Helpers.getFunctionSignature(NoArgumentInstance, 'noArgument'),
            Helpers.getFunctionSignature(OneArgumentInstance, 'oneArgument'),
            Helpers.getFunctionSignature(TwoArgumentsInstance, 'twoArguments'),
            Helpers.getFunctionSignature(ThreeArgumentsInstance, 'threeArguments'),
            Helpers.getFunctionSignature(WithDepositorInstance, 'withDepositor'),
            Helpers.getFunctionSignature(ReturnDataInstance, 'returnData'),
        ];
        initialDepositFunctionDepositorOffsets = [
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            12,
            Helpers.blankFunctionDepositorOffset,
        ];
        initialExecuteFunctionSignatures = [
            Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store'),
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
        ];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address);

        await Promise.all([
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[0], initialContractAddresses[0], initialDepositFunctionSignatures[0], initialDepositFunctionDepositorOffsets[0], initialExecuteFunctionSignatures[0]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[1], initialContractAddresses[1], initialDepositFunctionSignatures[1], initialDepositFunctionDepositorOffsets[1], initialExecuteFunctionSignatures[1]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[2], initialContractAddresses[2], initialDepositFunctionSignatures[2], initialDepositFunctionDepositorOffsets[2], initialExecuteFunctionSignatures[2]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[3], initialContractAddresses[3], initialDepositFunctionSignatures[3], initialDepositFunctionDepositorOffsets[3], initialExecuteFunctionSignatures[3]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[4], initialContractAddresses[4], initialDepositFunctionSignatures[4], initialDepositFunctionDepositorOffsets[4], initialExecuteFunctionSignatures[4]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[5], initialContractAddresses[5], initialDepositFunctionSignatures[5], initialDepositFunctionDepositorOffsets[5], initialExecuteFunctionSignatures[5]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, initialResourceIDs[6], initialContractAddresses[6], initialDepositFunctionSignatures[6], initialDepositFunctionDepositorOffsets[6], initialExecuteFunctionSignatures[6])
        ]);

        depositData = Helpers.createGenericDepositData('0xdeadbeef');

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it('deposit can be made successfully', async () => {
        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[0],
            depositData,
            feeData,
            { from: depositorAddress }
        ));
    });

    it('depositEvent is emitted with expected values', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[0],
            depositData,
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[0].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === depositData &&
                event.handlerResponse === null
        });
    });

    it('noArgument can be called successfully and deposit event is emitted with expected values', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[1],
            Helpers.createGenericDepositData(null),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[1].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createGenericDepositData(null) &&
                event.handlerResponse === null
        });

        const internalTx = await TruffleAssert.createTransactionResult(NoArgumentInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'NoArgumentCalled');
    });

    it('oneArgument can be called successfully and deposit event is emitted with expected values', async () => {
        const argumentOne = 42;

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[2],
            Helpers.createGenericDepositData(Helpers.toHex(argumentOne, 32)),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[2].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createGenericDepositData(Helpers.toHex(argumentOne, 32)) &&
                event.handlerResponse === null
        });

        const internalTx = await TruffleAssert.createTransactionResult(OneArgumentInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'OneArgumentCalled', event => event.argumentOne.toNumber() === argumentOne);
    });

    it('twoArguments can be called successfully and deposit event is created with expected values', async () => {
        const argumentOne = [NoArgumentInstance.address, OneArgumentInstance.address, TwoArgumentsInstance.address];
        const argumentTwo = initialDepositFunctionSignatures[3];
        const encodedMetaData = Helpers.abiEncode(['address[]','bytes4'], [argumentOne, argumentTwo]);

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[3],
            Helpers.createGenericDepositData(encodedMetaData),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[3].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createGenericDepositData(encodedMetaData) &&
                event.handlerResponse === null
        });

        const internalTx = await TruffleAssert.createTransactionResult(TwoArgumentsInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'TwoArgumentsCalled', event => {
            return JSON.stringify(event.argumentOne), JSON.stringify(argumentOne) &&
            event.argumentTwo === argumentTwo
        });
    });

    it('threeArguments can be called successfully and deposit event is emitted with expected values', async () => {
        const argumentOne = 'soylentGreenIsPeople';
        const argumentTwo = -42;
        const argumentThree = true;
        const encodedMetaData = Helpers.abiEncode(['string','int8','bool'], [argumentOne, argumentTwo, argumentThree]);

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[4],
            Helpers.createGenericDepositData(encodedMetaData),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[4].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createGenericDepositData(encodedMetaData) &&
                event.handlerResponse === null
        });

        const internalTx = await TruffleAssert.createTransactionResult(ThreeArgumentsInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'ThreeArgumentsCalled', event =>
            event.argumentOne === argumentOne &&
            event.argumentTwo.toNumber() === argumentTwo &&
            event.argumentThree === argumentThree);
    });

    it('withDepositor can be called successfully and deposit event is emitted with expected values', async () => {
        const argumentOne = depositorAddress;
        const argumentTwo = 100;
        const encodedMetaData = Helpers.abiEncode(['address','uint256'], [argumentOne, argumentTwo]);

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[5],
            Helpers.createGenericDepositData(encodedMetaData),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[5].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createGenericDepositData(encodedMetaData) &&
                event.handlerResponse === null
        });

        const internalTx = await TruffleAssert.createTransactionResult(WithDepositorInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'WithDepositorCalled', event =>
            event.argumentOne === argumentOne &&
            event.argumentTwo.toNumber() === argumentTwo);
    });

    it('depositor is enforced in the metadata', async () => {
        const anotherDepositor = accounts[2];
        const argumentOne = anotherDepositor;
        const argumentTwo = 100;
        const encodedMetaData = Helpers.abiEncode(['address','uint256'], [argumentOne, argumentTwo]);

        await TruffleAssert.reverts(BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[5],
            Helpers.createGenericDepositData(encodedMetaData),
            feeData,
            { from: depositorAddress }
        ), 'incorrect depositor in the data');
    });

    it('returnedData can be called successfully and deposit event is emitted with expect values', async () => {
        const argument = 'soylentGreenIsPeople';
        const encodedMetaData = Helpers.abiEncode(['string'], [argument]);

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            initialResourceIDs[6],
            Helpers.createGenericDepositData(encodedMetaData),
            feeData,
            { from: depositorAddress }
        );

        const expectedMetaData = Ethers.utils.formatBytes32String(argument);

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === initialResourceIDs[6].toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createGenericDepositData(encodedMetaData) &&
                event.handlerResponse === expectedMetaData
        });
    })
});
