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

contract('GenericHandler - [Execute Proposal]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const expectedDepositNonce = 1;
    const relayer1Address = accounts[2];
    const relayer2Address = accounts[3];

    const depositerAddress = accounts[1];

    const centrifugeAssetMinCount = 10;
    const hashOfCentrifugeAsset = Ethers.utils.keccak256('0xc0ffee');
    const feeData = '0x';

    let BridgeInstance;
    let CentrifugeAssetInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialDepositFunctionDepositerOffsets;
    let initialExecuteFunctionSignatures;
    let GenericHandlerInstance;
    let resourceID;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(destinationDomainID).then(instance => BridgeInstance = instance),
            CentrifugeAssetContract.new(centrifugeAssetMinCount).then(instance => CentrifugeAssetInstance = instance)
        ]);

        const centrifugeAssetFuncSig = Helpers.getFunctionSignature(CentrifugeAssetInstance, 'store');

        resourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, originDomainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [CentrifugeAssetInstance.address];
        initialDepositFunctionSignatures = [Helpers.blankFunctionSig];
        initialDepositFunctionDepositerOffsets = [Helpers.blankFunctionDepositerOffset];
        initialExecuteFunctionSignatures = [centrifugeAssetFuncSig];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address);

        await BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, resourceID,  initialContractAddresses[0], initialDepositFunctionSignatures[0], initialDepositFunctionDepositerOffsets[0], initialExecuteFunctionSignatures[0]);

        depositData = Helpers.createGenericDepositData(hashOfCentrifugeAsset);
        depositProposalDataHash = Ethers.utils.keccak256(GenericHandlerInstance.address + depositData.substr(2));

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it('deposit can be executed successfully', async () => {
        const proposalSignedData = await Helpers.signDataWithMpc(originDomainID, destinationDomainID, expectedDepositNonce, depositData, resourceID);

        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositerAddress }
        ));

        // relayer1 executes the proposal
        await TruffleAssert.passes(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonce,
            depositData,
            resourceID,
            proposalSignedData,
            { from: relayer1Address }
        ));

        // Verifying asset was marked as stored in CentrifugeAssetInstance
        assert.isTrue(await CentrifugeAssetInstance._assetsStored.call(hashOfCentrifugeAsset));
    });

    it('AssetStored event should be emitted', async () => {
        const proposalSignedData = await Helpers.signDataWithMpc(originDomainID, destinationDomainID, expectedDepositNonce, depositData, resourceID);


        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositerAddress }
        ));

        // relayer1 executes the proposal
        const executeTx = await BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonce,
            depositData,
            resourceID,
            proposalSignedData,
            { from: relayer2Address }
        );
        const internalTx = await TruffleAssert.createTransactionResult(CentrifugeAssetInstance, executeTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'AssetStored', event => {
          return event.asset === hashOfCentrifugeAsset;
        });

        assert.isTrue(await CentrifugeAssetInstance._assetsStored.call(hashOfCentrifugeAsset),
            'Centrifuge Asset was not successfully stored');
    });
});
