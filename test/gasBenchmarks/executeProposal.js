/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const GenericHandlerContract = artifacts.require("GenericHandler");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const NoArgumentContract = artifacts.require("NoArgument");
const OneArgumentContract = artifacts.require("OneArgument");
const TwoArgumentsContract = artifacts.require("TwoArguments");
const ThreeArgumentsContract = artifacts.require("ThreeArguments");

contract('Gas Benchmark - [Execute Proposal]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const adminAddress = accounts[0]
    const depositorAddress = accounts[1];
    const recipientAddress = accounts[2];

    const lenRecipientAddress = 20;
    const gasBenchmarks = [];

    const erc20TokenAmount = 100;
    const erc721TokenID = 1;
    const erc1155TokenID = 1;
    const erc1155TokenAmount = 100;
    const feeData = '0x';

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;
    let ERC721MintableInstance;
    let ERC721HandlerInstance;
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

    const deposit = (resourceID, depositData) => BridgeInstance.deposit(originDomainID, resourceID, depositData, feeData, { from: depositorAddress });
    const execute = async (originDomainID, depositNonce, depositData, resourceID) => {
      const proposal = {
        originDomainID: originDomainID,
        depositNonce: depositNonce,
        data: depositData,
        resourceID: resourceID
      };

      const signature = await Helpers.signTypedProposal(BridgeInstance.address, [proposal]);
      return BridgeInstance.executeProposal(proposal, signature);
    };

    before(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(destinationDomainID, adminAddress),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance = instance),
            ERC1155MintableContract.new("TOK").then(instance => ERC1155MintableInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            NoArgumentContract.new().then(instance => NoArgumentInstance = instance),
            OneArgumentContract.new().then(instance => OneArgumentInstance = instance),
            TwoArgumentsContract.new().then(instance => TwoArgumentsInstance = instance),
            ThreeArgumentsContract.new().then(instance => ThreeArgumentsInstance = instance)
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);
        erc721ResourceID = Helpers.createResourceID(ERC721MintableInstance.address, originDomainID);
        erc1155ResourceID = Helpers.createResourceID(ERC1155MintableInstance.address, originDomainID);
        centrifugeAssetResourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, originDomainID);
        noArgumentResourceID = Helpers.createResourceID(NoArgumentInstance.address, originDomainID);
        oneArgumentResourceID = Helpers.createResourceID(OneArgumentInstance.address, originDomainID);
        twoArgumentsResourceID = Helpers.createResourceID(TwoArgumentsInstance.address, originDomainID);
        threeArgumentsResourceID = Helpers.createResourceID(ThreeArgumentsInstance.address, originDomainID);

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
        const genericInitialDepositFunctionDepositorOffsets = [
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset,
            Helpers.blankFunctionDepositorOffset];
        const genericInitialExecuteFunctionSignatures = [
            Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store'),
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig,
            Helpers.blankFunctionSig];

        await Promise.all([
            ERC20HandlerContract.new(BridgeInstance.address).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance.mint(depositorAddress, erc20TokenAmount),
            ERC721HandlerContract.new(BridgeInstance.address).then(instance => ERC721HandlerInstance = instance),
            ERC721MintableInstance.mint(depositorAddress, erc721TokenID, ""),
            ERC1155HandlerContract.new(BridgeInstance.address).then(instance => ERC1155HandlerInstance = instance),
            ERC1155MintableInstance.mintBatch(depositorAddress, [erc1155TokenID], [erc1155TokenAmount], "0x0"),
            GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address)
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, erc20TokenAmount, { from: depositorAddress }),
            ERC721MintableInstance.approve(ERC721HandlerInstance.address, erc721TokenID, { from: depositorAddress }),
            ERC1155MintableInstance.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositorAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, erc721ResourceID, ERC721MintableInstance.address),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, erc1155ResourceID, ERC1155MintableInstance.address),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, centrifugeAssetResourceID, genericInitialContractAddresses[0], genericInitialDepositFunctionSignatures[0], genericInitialDepositFunctionDepositorOffsets[0], genericInitialExecuteFunctionSignatures[0]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, noArgumentResourceID, genericInitialContractAddresses[1], genericInitialDepositFunctionSignatures[1], genericInitialDepositFunctionDepositorOffsets[1], genericInitialExecuteFunctionSignatures[1]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, oneArgumentResourceID, genericInitialContractAddresses[2], genericInitialDepositFunctionSignatures[2], genericInitialDepositFunctionDepositorOffsets[2], genericInitialExecuteFunctionSignatures[2]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, twoArgumentsResourceID, genericInitialContractAddresses[3], genericInitialDepositFunctionSignatures[3], genericInitialDepositFunctionDepositorOffsets[3], genericInitialExecuteFunctionSignatures[3]),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, threeArgumentsResourceID, genericInitialContractAddresses[4], genericInitialDepositFunctionSignatures[4], genericInitialDepositFunctionDepositorOffsets[4], genericInitialExecuteFunctionSignatures[4])
        ]);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it('Should execute ERC20 deposit proposal', async () => {
        const depositNonce = 1;
        const depositData = Helpers.createERCDepositData(
            erc20TokenAmount,
            lenRecipientAddress,
            recipientAddress);

        await deposit(erc20ResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, erc20ResourceID);

        gasBenchmarks.push({
            type: 'ERC20',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should execute ERC721 deposit proposal', async () => {
        const depositNonce = 2;
        const lenMetaData = 0;
        const metaData = "0x";
        const depositData = Helpers.createERC721DepositProposalData(
            erc721TokenID,
            lenRecipientAddress,
            recipientAddress,
            lenMetaData,
            metaData);

        await deposit(erc721ResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, erc721ResourceID);

        gasBenchmarks.push({
            type: 'ERC721',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should execute ERC1155 deposit proposal', async () => {
        const depositNonce = 3;
        const metaData = "0x";
        const depositData = Helpers.createERC1155DepositProposalData([erc1155TokenID], [erc1155TokenAmount], recipientAddress, metaData);

        await deposit(erc1155ResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, erc1155ResourceID);

        gasBenchmarks.push({
            type: 'ERC1155',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should execute Generic deposit proposal - Centrifuge asset', async () => {
        const depositNonce = 4;
        const hashOfCentrifugeAsset = Ethers.utils.keccak256('0xc0ffee');
        const depositData = Helpers.createGenericDepositData(hashOfCentrifugeAsset);

        await deposit(centrifugeAssetResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, centrifugeAssetResourceID);

        gasBenchmarks.push({
            type: 'Generic - Centrifuge Asset',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should execute Generic deposit proposal - No Argument', async () => {
        const depositNonce = 5;
        const depositData = Helpers.createGenericDepositData(null);

        await deposit(noArgumentResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, noArgumentResourceID,);

        gasBenchmarks.push({
            type: 'Generic - No Argument',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - One Argument', async () => {
        const depositNonce = 6;
        const depositData = Helpers.createGenericDepositData(Helpers.toHex(42, 32));

        await deposit(oneArgumentResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, oneArgumentResourceID);

        gasBenchmarks.push({
            type: 'Generic - One Argument',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - Two Arguments', async () => {
        const depositNonce = 7;
        const argumentOne = [NoArgumentInstance.address, OneArgumentInstance.address, TwoArgumentsInstance.address];
        const argumentTwo = Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store');
        const encodedMetaData = Helpers.abiEncode(['address[]','bytes4'], [argumentOne, argumentTwo]);
        const depositData = Helpers.createGenericDepositData(encodedMetaData);

        await deposit(twoArgumentsResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, twoArgumentsResourceID);

        gasBenchmarks.push({
            type: 'Generic - Two Argument',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should make Generic deposit - Three Arguments', async () => {
        const depositNonce = 8;
        const argumentOne = 'soylentGreenIsPeople';
        const argumentTwo = -42;
        const argumentThree = true;
        const encodedMetaData = Helpers.abiEncode(['string','int8','bool'], [argumentOne, argumentTwo, argumentThree]);
        const depositData = Helpers.createGenericDepositData(encodedMetaData);

        await deposit(threeArgumentsResourceID, depositData);
        const executeTx = await execute(originDomainID, depositNonce, depositData, threeArgumentsResourceID);

        gasBenchmarks.push({
            type: 'Generic - Three Argument',
            gasUsed: executeTx.receipt.gasUsed
        });
    });

    it('Should print out benchmarks', () => console.table(gasBenchmarks));
});
