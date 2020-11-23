/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('Bridge - [create a deposit proposal (voteProposal) with relayerThreshold = 1]', async (accounts) => {
    const originChainRelayerAddress = accounts[1];
    const originChainRelayerBit = 1 << 0;
    const depositerAddress = accounts[2];
    const destinationRecipientAddress = accounts[3];
    const originChainID = 1;
    const destinationChainID = 2;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 1;
    const expectedCreateEventStatus = 1;
    
    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let resourceID;
    let data = '';
    let dataHash = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance),
            BridgeContract.new(originChainID, [originChainRelayerAddress], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance)
        ]);

        initialResourceIDs = [];
        initialContractAddresses = [];
        burnableContractAddresses = [];

        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, destinationChainID);

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        await BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address);
        
        data = Helpers.createERCDepositData(
            depositAmount,
            20,
            destinationRecipientAddress);
        dataHash = Ethers.utils.keccak256(data);
    });

    it('should create depositProposal successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: depositerAddress }
        ));
    });

    it("depositProposal shouldn't be created if it has an Active status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it("getProposal should be called successfully", async () => {
        await TruffleAssert.passes(BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce, dataHash
        ));
    });

    it('depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _yesVotes: originChainRelayerBit.toString(),
            _yesVotesTotal: '1',
            _status: '2' // passed
        };

        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        );

        const depositProposal = await BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce, dataHash);
        Helpers.assertObjectsMatch(expectedDepositProposal, Object.assign({}, depositProposal));
    });

    it('originChainRelayerAddress should be marked as voted for proposal', async () => {
        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        );
        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, destinationChainID), dataHash, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalCreated event should be emitted with expected values', async () => {
        const proposalTx = await BridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        );

        TruffleAssert.eventEmitted(proposalTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedCreateEventStatus &&
                event.dataHash === dataHash
        });
    });
});

contract('Bridge - [create a deposit proposal (voteProposal) with relayerThreshold > 1]', async (accounts) => {
    // const minterAndRelayer = accounts[0];
    const originChainRelayerAddress = accounts[1];
    const originChainRelayerBit = 1 << 0;
    const depositerAddress = accounts[2];
    const destinationRecipientAddress = accounts[3];
    const originChainID = 1;
    const destinationChainID = 2;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 2;
    const expectedCreateEventStatus = 1;

    
    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let resourceID;
    let data = '';
    let dataHash = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance),
            BridgeContract.new(originChainID, [originChainRelayerAddress], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance)
        ]);
        
        initialResourceIDs = [];
        initialContractAddresses = [];
        burnableContractAddresses = [];

        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, destinationChainID);

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        await BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address);
        
        data = Helpers.createERCDepositData(
            depositAmount,
            20,
            destinationRecipientAddress);
        dataHash = Ethers.utils.keccak256(data);
    });

    it('should create depositProposal successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: depositerAddress }
        ));
    });

    it("depositProposal shouldn't be created if it has an Active status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it('depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _yesVotes: originChainRelayerBit.toString(),
            _yesVotesTotal: '1',
            _status: '1' // active
        };

        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        );

        const depositProposal = await BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce, dataHash);
        Helpers.assertObjectsMatch(expectedDepositProposal, Object.assign({}, depositProposal));
    });

    it('originChainRelayerAddress should be marked as voted for proposal', async () => {
        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        );
        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, destinationChainID), dataHash, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalCreated event should be emitted with expected values', async () => {
        const proposalTx = await BridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            resourceID,
            dataHash,
            { from: originChainRelayerAddress }
        );

        TruffleAssert.eventEmitted(proposalTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedCreateEventStatus &&
                event.dataHash === dataHash
        });
    });
});