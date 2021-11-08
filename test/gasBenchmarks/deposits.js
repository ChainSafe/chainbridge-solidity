/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const GenericHandlerContract = artifacts.require("GenericHandler");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const NoArgumentContract = artifacts.require("NoArgument");
const OneArgumentContract = artifacts.require("OneArgument");
const TwoArgumentsContract = artifacts.require("TwoArguments");
const ThreeArgumentsContract = artifacts.require("ThreeArguments");

const Helpers = require('../helpers');

contract('Gas Benchmark - [Deposits]', async (accounts) => {
    const domainID = 1;
    const relayerThreshold = 1;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const lenRecipientAddress = 20;
    const gasBenchmarks = [];

    const erc20TokenAmount = 100;
    const erc721TokenID = 1;
    const erc1155TokenID = 1;
    const erc1155TokenAmount = 100;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;
    let ERC721MintableInstance;
    let ERC721HandlerInstance;
    let ERC1155MintableInstance;
    let ERC1155HandlerInstance;
    let CentrifugeAssetInstance;
    let NoArgumentInstance;
    let OneArgumentInstance;
    let TwoArgumentsInstance;
    let ThreeArgumentsInstance;

    let erc20ResourceID;
    let erc721ResourceID;
    let erc1155ResourceID;
    let centrifugeAssetResourceID;
    let noArgumentResourceID;
    let oneArgumentResourceID;
    let twoArgumentsResourceID;
    let threeArgumentsResourceID;

    before(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance = instance),
            ERC1155MintableContract.new("TOK").then(instance => ERC1155MintableInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            NoArgumentContract.new().then(instance => NoArgumentInstance = instance),
            OneArgumentContract.new().then(instance => OneArgumentInstance = instance),
            TwoArgumentsContract.new().then(instance => TwoArgumentsInstance = instance),
            ThreeArgumentsContract.new().then(instance => ThreeArgumentsInstance = instance)
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
        erc721ResourceID = Helpers.createResourceID(ERC721MintableInstance.address, domainID);
        erc1155ResourceID = Helpers.createResourceID(ERC1155MintableInstance.address, domainID);
        centrifugeAssetResourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, domainID);
        noArgumentResourceID = Helpers.createResourceID(NoArgumentInstance.address, domainID);
        oneArgumentResourceID = Helpers.createResourceID(OneArgumentInstance.address, domainID);
        twoArgumentsResourceID = Helpers.createResourceID(TwoArgumentsInstance.address, domainID);
        threeArgumentsResourceID = Helpers.createResourceID(ThreeArgumentsInstance.address, domainID);
        
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
            ERC20HandlerContract.new(BridgeInstance.address).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance.mint(depositerAddress, erc20TokenAmount),
            ERC721HandlerContract.new(BridgeInstance.address).then(instance => ERC721HandlerInstance = instance),
            ERC721MintableInstance.mint(depositerAddress, erc721TokenID, ""),
            ERC1155HandlerContract.new(BridgeInstance.address).then(instance => ERC1155HandlerInstance = instance),
            ERC1155MintableInstance.mintBatch(depositerAddress, [erc1155TokenID], [erc1155TokenAmount], "0x0"),
            GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address)
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, erc20TokenAmount, { from: depositerAddress }),
            ERC721MintableInstance.approve(ERC721HandlerInstance.address, erc721TokenID, { from: depositerAddress }),
            ERC1155MintableInstance.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, erc721ResourceID, ERC721MintableInstance.address),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, erc1155ResourceID, ERC1155MintableInstance.address),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, centrifugeAssetResourceID, genericInitialContractAddresses[0], genericInitialDepositFunctionSignatures[0], genericInitialDepositFunctionDepositerOffsets[0], genericInitialExecuteFunctionSignatures[0]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, noArgumentResourceID, genericInitialContractAddresses[1], genericInitialDepositFunctionSignatures[1], genericInitialDepositFunctionDepositerOffsets[1], genericInitialExecuteFunctionSignatures[1]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, oneArgumentResourceID, genericInitialContractAddresses[2], genericInitialDepositFunctionSignatures[2], genericInitialDepositFunctionDepositerOffsets[2], genericInitialExecuteFunctionSignatures[2]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, twoArgumentsResourceID, genericInitialContractAddresses[3], genericInitialDepositFunctionSignatures[3], genericInitialDepositFunctionDepositerOffsets[3], genericInitialExecuteFunctionSignatures[3]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, threeArgumentsResourceID, genericInitialContractAddresses[4], genericInitialDepositFunctionSignatures[4], genericInitialDepositFunctionDepositerOffsets[4], genericInitialExecuteFunctionSignatures[4])
        ]);
    });

    it('Should make ERC20 deposit', async () => {
        const depositTx = await BridgeInstance.deposit(
            domainID,
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
            domainID,
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

    it('Should make ERC1155 deposit', async () => {
        const depositTx = await BridgeInstance.deposit(
            domainID,
            erc1155ResourceID,
            Helpers.createERC1155DepositData(
                [erc1155TokenID],
                [erc1155TokenAmount]),
            { from: depositerAddress });

        gasBenchmarks.push({
            type: 'ERC1155',
            gasUsed: depositTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - Centrifuge asset', async () => {
        const depositTx = await BridgeInstance.deposit(
            domainID,
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
            domainID,
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
            domainID,
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
            domainID,
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
            domainID,
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
