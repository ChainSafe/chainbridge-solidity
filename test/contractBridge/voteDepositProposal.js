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
    const relayer4Address = accounts[3]
    const depositerAddress = accounts[4];
    const destinationChainRecipientAddress = accounts[4];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 3;

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
                0).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originChainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        depositData = Helpers.createERCDepositData(resourceID, depositAmount, 32, destinationChainRecipientAddress);
        depositDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + depositData.substr(2));

        await Promise.all([
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationERC20HandlerInstance.address),
            BridgeInstance.adminSetHandlerAddress(DestinationERC20HandlerInstance.address, resourceID)
        ]);

        vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedDepositNonce, resourceID, depositDataHash, {from: relayer})
        executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedDepositNonce, depositData, {from: relayer})
    });

    it ('[sanity] bridge configured with threshold and relayers', async () => {
        assert.equal(await BridgeInstance._chainID(), destinationChainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')
    })

    it('[sanity] depositProposal should be created with expected values', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [relayer1Address],
            _noVotes: [],
            _status: '1' // Active
        };

        const depositProposal = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce);

        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(vote(depositerAddress));
    });

    it("depositProposal shouldn't be voted on if it has a Passed status", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.reverts(vote(relayer4Address), 'proposal has already been passed or transferred');
    });

    it("depositProposal shouldn't be voted on if it has a Transferred status", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.passes(executeProposal(relayer1Address));

        await TruffleAssert.reverts(vote(relayer4Address), 'proposal has already been passed or transferred');

    });

    it("relayer shouldn't be able to vote on a depositProposal more than once", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.reverts(vote(relayer1Address), 'relayer has already voted on proposal');
    });

    it("Relayer's vote should be recorded correctly - yes vote", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const depositProposalAfterFirstVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterFirstVote._yesVotes.length, 1);
        assert.deepEqual(depositProposalAfterFirstVote._yesVotes, [relayer1Address]);
        assert.strictEqual(depositProposalAfterFirstVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterFirstVote._status, '1');

        await TruffleAssert.passes(vote(relayer2Address));

        const depositProposalAfterSecondVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterSecondVote._yesVotes.length, 2);
        assert.deepEqual(depositProposalAfterSecondVote._yesVotes, [relayer1Address, relayer2Address]);
        assert.strictEqual(depositProposalAfterSecondVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterSecondVote._status, '1');

        await TruffleAssert.passes(vote(relayer3Address));

        const depositProposalAfterThirdVote = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterThirdVote._yesVotes.length, 3);
        assert.deepEqual(depositProposalAfterThirdVote._yesVotes, [relayer1Address, relayer2Address, relayer3Address]);
        assert.strictEqual(depositProposalAfterThirdVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterThirdVote._status, '2');

        await TruffleAssert.passes(executeProposal(relayer1Address));

        const depositProposalAfterExecute = await BridgeInstance.getProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterExecute._yesVotes.length, 3);
        assert.deepEqual(depositProposalAfterExecute._yesVotes, [relayer1Address, relayer2Address, relayer3Address]);
        assert.strictEqual(depositProposalAfterExecute._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterExecute._status, '3');
    });

    it("Relayer's address should be marked as voted for proposal", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            originChainID, expectedDepositNonce, relayer1Address);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalFinalized', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });

    it('DepositProposalVote event fired when proposal vote made', async () => {
        const voteTx = await vote(relayer1Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalVote', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === 1
        });
    });

    it('Execution successful', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalFinalized', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        const executionTx = await executeProposal(relayer1Address)

        TruffleAssert.eventEmitted(executionTx, 'ProposalExecuted', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});