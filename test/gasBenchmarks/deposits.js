/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const GenericHandlerContract = artifacts.require("GenericHandler");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const NoArgumentContract = artifacts.require("NoArgument");
const OneArgumentContract = artifacts.require("OneArgument");
const TwoArgumentsContract = artifacts.require("TwoArguments");
const ThreeArgumentsContract = artifacts.require("ThreeArguments");

const Helpers = require('../helpers');

contract('Gas Benchmark - [Deposits]', async (accounts) => {
    const chainID = 1;
    const relayerThreshold = 1;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const lenRecipientAddress = 20;
    const gasBenchmarks = [];

    const erc20TokenAmount = 100;
    const erc721TokenID = 1;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;
    let ERC721MintableInstance;
    let ERC721HandlerInstance;
    let CentrifugeAssetInstance;
    let NoArgumentInstance;
    let OneArgumentInstance;
    let TwoArgumentsInstance;
    let ThreeArgumentsInstance;

    let erc20ResourceID;
    let erc721ResourceID;
    let centrifugeAssetResourceID;
    let noArgumentResourceID;
    let oneArgumentResourceID;
    let twoArgumentsResourceID;
    let threeArgumentsResourceID;

    before(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            NoArgumentContract.new().then(instance => NoArgumentInstance = instance),
            OneArgumentContract.new().then(instance => OneArgumentInstance = instance),
            TwoArgumentsContract.new().then(instance => TwoArgumentsInstance = instance),
            ThreeArgumentsContract.new().then(instance => ThreeArgumentsInstance = instance)
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);
        erc721ResourceID = Helpers.createResourceID(ERC721MintableInstance.address, chainID);
        centrifugeAssetResourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, chainID);
        noArgumentResourceID = Helpers.createResourceID(NoArgumentInstance.address, chainID);
        oneArgumentResourceID = Helpers.createResourceID(OneArgumentInstance.address, chainID);
        twoArgumentsResourceID = Helpers.createResourceID(TwoArgumentsInstance.address, chainID);
        threeArgumentsResourceID = Helpers.createResourceID(ThreeArgumentsInstance.address, chainID);

        const erc20InitialResourceIDs = [erc20ResourceID];
        const erc20InitialContractAddresses = [ERC20MintableInstance.address];
        const erc20BurnableContractAddresses = [];

        const erc721InitialResourceIDs = [erc721ResourceID];
        const erc721InitialContractAddresses = [ERC721MintableInstance.address];
        const erc721BurnableContractAddresses = [];
        
        const genericInitialResourceIDs = [
            centrifugeAssetResourceID,
            noArgumentResourceID,
            oneArgumentResourceID,
            twoArgumentsResourceID,
            threeArgumentsResourceID];
        const genericInitialContractAddresses = initialContractAddresses = [
            CentrifugeAssetInstance.address,
            NoArgumentInstance.address,
            OneArgumentInstance.address,
            TwoArgumentsInstance.address,
            ThreeArgumentsInstance.address];
        const genericInitialDepositFunctionSignatures = [
            Helpers.blankFunctionSig,
            Helpers.getFunctionSignature(NoArgumentInstance, 'noArgument'),
            Helpers.getFunctionSignature(OneArgumentInstance, 'oneArgument'),
            Helpers.getFunctionSignature(TwoArgumentsInstance, 'twoArguments'),
            Helpers.getFunctionSignature(ThreeArgumentsInstance, 'threeArguments')];
        const genericInitialDepositFunctionDepositerOffsets = [
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset,
            Helpers.blankFunctionDepositerOffset];
        const genericInitialExecuteFunctionSignatures = [
            Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store'),
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig];

        await Promise.all([
            ERC20HandlerContract.new(BridgeInstance.address, erc20InitialResourceIDs, erc20InitialContractAddresses, erc20BurnableContractAddresses).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance.mint(depositerAddress, erc20TokenAmount),
            ERC721HandlerContract.new(BridgeInstance.address, erc721InitialResourceIDs, erc721InitialContractAddresses, erc721BurnableContractAddresses).then(instance => ERC721HandlerInstance = instance),
            ERC721MintableInstance.mint(depositerAddress, erc721TokenID, ""),
            GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address, genericInitialResourceIDs, genericInitialContractAddresses, genericInitialDepositFunctionSignatures, genericInitialDepositFunctionDepositerOffsets, genericInitialExecuteFunctionSignatures)
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, erc20TokenAmount, { from: depositerAddress }),
            ERC721MintableInstance.approve(ERC721HandlerInstance.address, erc721TokenID, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, erc721ResourceID, ERC721MintableInstance.address),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, centrifugeAssetResourceID, genericInitialContractAddresses[0], genericInitialDepositFunctionSignatures[0], genericInitialDepositFunctionDepositerOffsets[0], genericInitialExecuteFunctionSignatures[0]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, noArgumentResourceID, genericInitialContractAddresses[1], genericInitialDepositFunctionSignatures[1], genericInitialDepositFunctionDepositerOffsets[1], genericInitialExecuteFunctionSignatures[1]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, oneArgumentResourceID, genericInitialContractAddresses[2], genericInitialDepositFunctionSignatures[2], genericInitialDepositFunctionDepositerOffsets[2], genericInitialExecuteFunctionSignatures[2]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, twoArgumentsResourceID, genericInitialContractAddresses[3], genericInitialDepositFunctionSignatures[3], genericInitialDepositFunctionDepositerOffsets[3], genericInitialExecuteFunctionSignatures[3]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, threeArgumentsResourceID, genericInitialContractAddresses[4], genericInitialDepositFunctionSignatures[4], genericInitialDepositFunctionDepositerOffsets[4], genericInitialExecuteFunctionSignatures[4])
        ]);
    });

    it('Should make ERC20 deposit', async () => {
        const depositTx = await BridgeInstance.deposit(
            chainID,
            erc20ResourceID,
            Helpers.createERCDepositData(
                erc20TokenAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress });

        gasBenchmarks.push({
            type: 'ERC20',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make ERC721 deposit', async () => {
        const depositTx = await BridgeInstance.deposit(
            chainID,
            erc721ResourceID,
            Helpers.createERCDepositData(
                erc721TokenID,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress });

        gasBenchmarks.push({
            type: 'ERC721',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - Centrifuge asset', async () => {
        const depositTx = await BridgeInstance.deposit(
            chainID,
            centrifugeAssetResourceID,
            Helpers.createGenericDepositData('0xc0ff33'),
            { from: depositerAddress }
        );

        gasBenchmarks.push({
            type: 'Generic - Centrifuge Asset',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - No Argument', async () => {
        const depositTx = await BridgeInstance.deposit(
            chainID,
            noArgumentResourceID,
            Helpers.createGenericDepositData(null),
            { from: depositerAddress }
        );

        gasBenchmarks.push({
            type: 'Generic - No Argument',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - One Argument', async () => {
        const depositTx = await BridgeInstance.deposit(
            chainID,
            oneArgumentResourceID,
            Helpers.createGenericDepositData(Helpers.toHex(42, 32)),
            { from: depositerAddress }
        );

        gasBenchmarks.push({
            type: 'Generic - One Argument',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - Two Arguments', async () => {
        const argumentOne = [NoArgumentInstance.address, OneArgumentInstance.address, TwoArgumentsInstance.address];
        const argumentTwo = Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store');
        const encodedMetaData = Helpers.abiEncode(['address[]','bytes4'], [argumentOne, argumentTwo]);
        const depositTx = await BridgeInstance.deposit(
            chainID,
            twoArgumentsResourceID,
            Helpers.createGenericDepositData(encodedMetaData),
            { from: depositerAddress }
        );

        gasBenchmarks.push({
            type: 'Generic - Two Arguments',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - Three Arguments', async () => {
        const argumentOne = 'soylentGreenIsPeople';
        const argumentTwo = -42;
        const argumentThree = true;
        const encodedMetaData = Helpers.abiEncode(['string','int8','bool'], [argumentOne, argumentTwo, argumentThree]);
        const depositTx = await BridgeInstance.deposit(
            chainID,
            threeArgumentsResourceID,
            Helpers.createGenericDepositData(encodedMetaData),
            { from: depositerAddress }
        );

        gasBenchmarks.push({
            type: 'Generic - Three Arguments',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should print out benchmarks', () => console.table(gasBenchmarks));
});
