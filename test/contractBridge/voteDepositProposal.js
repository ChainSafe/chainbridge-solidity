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

contract('Bridge - [voteProposal with relayerThreshold == 3]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const relayer1Address = accounts[0];
    const relayer2Address = accounts[1];
    const relayer3Address = accounts[2];
    const relayer4Address = accounts[3];
    const relayer1Bit = 1 << 0;
    const relayer2Bit = 1 << 1;
    const relayer3Bit = 1 << 2;
    const relayer4Bit = 1 << 3;
    const depositerAddress = accounts[4];
    const destinationChainRecipientAddress = accounts[4];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 3;
    const expectedFinalizedEventStatus = 2;
    const expectedExecutedEventStatus = 3;

    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let depositData = '';
    let depositDataHash = '';
    let resourceID = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    let vote, executeProposal;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(destinationChainID, [
                relayer1Address,
                relayer2Address,
                relayer3Address,
                relayer4Address], 
                relayerThreshold, 
                0,
                100,).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originChainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        depositData = Helpers.createERCDepositData(depositAmount, 20, destinationChainRecipientAddress);
        depositDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + depositData.substr(2));

        await Promise.all([
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationERC20HandlerInstance.address),
            BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address)
        ]);

        vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedDepositNonce, resourceID, depositDataHash, { from: relayer });
        executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedDepositNonce, depositData, resourceID, { from: relayer });
    });

    it ('[sanity] bridge configured with threshold and relayers', async () => {
        assert.equal(await BridgeInstance._chainID(), destinationChainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')
    })

    it('[sanity] depositProposal should be created with expected values', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const expectedDepositProposal = {
            _yesVotes: relayer1Bit.toString(),
            _yesVotesTotal: '1',
            _status: '1' // Active
        };

        const depositProposal = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);

        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(vote(depositerAddress));
    });

    it("depositProposal shouldn't be voted on if it has a Passed status", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.reverts(vote(relayer4Address), 'proposal already passed/executed/cancelled.');
    });

    it("depositProposal shouldn't be voted on if it has a Transferred status", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.passes(executeProposal(relayer1Address));

        await TruffleAssert.reverts(vote(relayer4Address), 'proposal already passed/executed/cancelled.');

    });

    it("relayer shouldn't be able to vote on a depositProposal more than once", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.reverts(vote(relayer1Address), 'relayer already voted');
    });

    it("Should be able to create a proposal with a different hash", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(
            BridgeInstance.voteProposal(
                originChainID, expectedDepositNonce,
                resourceID, Ethers.utils.keccak256(depositDataHash),
                { from: relayer2Address }));
    });

    it("Relayer's vote should be recorded correctly - yes vote", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const depositProposalAfterFirstVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterFirstVote._yesVotesTotal, 1);
        assert.equal(depositProposalAfterFirstVote._yesVotes, relayer1Bit);
        assert.strictEqual(depositProposalAfterFirstVote._status, '1');

        await TruffleAssert.passes(vote(relayer2Address));

        const depositProposalAfterSecondVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterSecondVote._yesVotesTotal, 2);
        assert.equal(depositProposalAfterSecondVote._yesVotes, relayer1Bit + relayer2Bit);
        assert.strictEqual(depositProposalAfterSecondVote._status, '1');

        await TruffleAssert.passes(vote(relayer3Address));

        const depositProposalAfterThirdVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterThirdVote._yesVotesTotal, 3);
        assert.equal(depositProposalAfterThirdVote._yesVotes, relayer1Bit + relayer2Bit + relayer3Bit);
        assert.strictEqual(depositProposalAfterThirdVote._status, '2');

        await TruffleAssert.passes(executeProposal(relayer1Address));

        const depositProposalAfterExecute = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterExecute._yesVotesTotal, 3);
        assert.equal(depositProposalAfterExecute._yesVotes, relayer1Bit + relayer2Bit + relayer3Bit);
        assert.strictEqual(depositProposalAfterExecute._status, '3');
    });

    it("Relayer's address should be marked as voted for proposal", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, originChainID), depositDataHash, relayer1Address);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === depositDataHash
        });
    });

    it('DepositProposalVote event fired when proposal vote made', async () => {
        const voteTx = await vote(relayer1Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalVote', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === 1
        });
    });

    it('Execution successful', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === depositDataHash
        });

        const executionTx = await executeProposal(relayer1Address)

        TruffleAssert.eventEmitted(executionTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
            event.depositNonce.toNumber() === expectedDepositNonce &&
            event.status.toNumber() === expectedExecutedEventStatus &&
            event.dataHash === depositDataHash
        });
    });

    it('Proposal cannot be executed twice', async () => {
        await vote(relayer1Address);
        await vote(relayer2Address);
        await vote(relayer3Address);
        await executeProposal(relayer1Address);
        await TruffleAssert.reverts(executeProposal(relayer1Address), "Proposal must have Passed status");
    });

    it('Execution requires active proposal', async () => {
        await TruffleAssert.reverts(BridgeInstance.executeProposal(originChainID, expectedDepositNonce, depositData, '0x0', { from: relayer1Address }), "Proposal must have Passed status");
    });

    it('Voting requires resourceID that is mapped to a handler', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(originChainID, expectedDepositNonce, '0x0', depositDataHash, { from: relayer1Address }), "no handler for resourceID");
    });
});
