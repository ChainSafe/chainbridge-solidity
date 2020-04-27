/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('GenericHandler - [deposit]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;
    const expectedDepositNonce = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const initialRelayers = [relayer1Address, relayer2Address];

    const centrifugeAssetMinCount = 10;
    const hashOfCentrifugeAsset = Ethers.utils.keccak256('0xc0ffee');
    const blankFunctionSig = '0x00000000';
    const centrifugeAssetFuncSig = Ethers.utils.keccak256(Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes('store(bytes32)'))).substr(0, 10);

    let BridgeInstance;
    let CentrifugeAssetInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialExecuteFunctionSignatures;
    let GenericHandlerInstance;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, initialRelayers, relayerThreshold, 0).then(instance => BridgeInstance = instance),
            CentrifugeAssetContract.new(centrifugeAssetMinCount).then(instance => CentrifugeAssetInstance = instance)
        ]);

        initialResourceIDs = [Ethers.utils.hexZeroPad((CentrifugeAssetInstance.address + Ethers.utils.hexlify(chainID).substr(2)), 32)];
        initialContractAddresses = [CentrifugeAssetInstance.address];
        initialDepositFunctionSignatures = [blankFunctionSig];
        initialExecuteFunctionSignatures = [centrifugeAssetFuncSig];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address,
            initialResourceIDs,
            initialContractAddresses,
            initialDepositFunctionSignatures,
            initialExecuteFunctionSignatures);

        depositData = '0x' +
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(36), 32).substr(2) +  // len(metaData) (36 bytes)
            hashOfCentrifugeAsset.substr(2)

        depositProposalData = '0x' +
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(36), 32).substr(2) +  // len(metaData) (36 bytes)
            hashOfCentrifugeAsset.substr(2)
        depositProposalDataHash = Ethers.utils.keccak256(GenericHandlerInstance.address + depositProposalData.substr(2));
    });

    it('deposit can be executed successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));

        // relayer1 creates the deposit proposal
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the deposit proposal
        // because the relayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await BridgeInstance.executeProposal(
            chainID,
            expectedDepositNonce,
            GenericHandlerInstance.address,
            depositProposalData,
            { from: relayer2Address }
        ));
        
        // Verifying asset was marked as stored in CentrifugeAssetInstance
        assert.isTrue(await CentrifugeAssetInstance._assetsStored.call(hashOfCentrifugeAsset));
    });

    it('AssetStored event should be emitted', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));

        // relayer1 creates the deposit proposal
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the deposit proposal
        // because the relayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        const executeDepositTx = await BridgeInstance.executeProposal(
            chainID,
            expectedDepositNonce,
            GenericHandlerInstance.address,
            depositProposalData,
            { from: relayer2Address }
        );

        const internalTx = await TruffleAssert.createTransactionResult(CentrifugeAssetInstance, executeDepositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'AssetStored', event => {
            return event.asset === hashOfCentrifugeAsset;
        });

        assert.isTrue(await CentrifugeAssetInstance._assetsStored.call(hashOfCentrifugeAsset),
            'Centrifuge Asset was not successfully stored');
    });
});
