/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ForwarderContract = artifacts.require("TestForwarder");

contract('Bridge - [voteProposal through forwarder]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const relayer1Address = accounts[0];
    const relayer2Address = accounts[1];
    const relayer3Address = accounts[2];
    const relayer4Address = accounts[3];
    const relayer1Bit = 1 << 0;
    const relayer2Bit = 1 << 1;
    const relayer3Bit = 1 << 2;
    const depositerAddress = accounts[4];
    const destinationChainRecipientAddress = accounts[4];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 3;
    const expectedFinalizedEventStatus = 2;

    const STATUS = {
        Inactive : '0',
        Active : '1',
        Passed : '2',
        Executed : '3',
        Cancelled : '4'
    }

    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let ForwarderInstance;
    let depositData = '';
    let depositDataHash = '';
    let resourceID = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    let voteCallData, executeCallData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(destinationDomainID, [
                relayer1Address,
                relayer2Address,
                relayer3Address,
                relayer4Address], 
                relayerThreshold, 
                0,
                100,).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originDomainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        ForwarderInstance = await ForwarderContract.new();

        await TruffleAssert.passes(BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, initialContractAddresses[0]));
        await TruffleAssert.passes(BridgeInstance.adminSetBurnable(DestinationERC20HandlerInstance.address, burnableContractAddresses[0]));

        depositData = Helpers.createERCDepositData(depositAmount, 20, destinationChainRecipientAddress);
        depositDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + depositData.substr(2));

        await Promise.all([
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationERC20HandlerInstance.address),
            BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address)
        ]);

        voteCallData = Helpers.createCallData(BridgeInstance, 'voteProposal', ["uint8", "uint64", "bytes32", "bytes"], [originDomainID, expectedDepositNonce, resourceID, depositData]);
        executeCallData = Helpers.createCallData(BridgeInstance, 'executeProposal', ["uint8", "uint64", "bytes", "bytes32", "bool"], [originDomainID, expectedDepositNonce, depositData, resourceID, true]);
        await BridgeInstance.adminSetForwarder(ForwarderInstance.address, true);
    });

    it ('[sanity] bridge configured with threshold and relayers', async () => {
        assert.equal(await BridgeInstance._domainID(), destinationDomainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')
    })

    it('[sanity] depositProposal should be created with expected values after the vote through forwarder', async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);
        const expectedDepositProposal = {
            _yesVotes: relayer1Bit.toString(),
            _yesVotesTotal: '1',
            _status: '1' // Active
        };

        const depositProposal = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);

        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('Calling through invalid forwarder should be reverted', async () => {
        let ForwarderInstance2 = await ForwarderContract.new();
        await TruffleAssert.reverts(ForwarderInstance2.execute(voteCallData, BridgeInstance.address, relayer1Address));
    });

    it("depositProposal should be automatically executed after the vote if proposal status is changed to Passed during the vote", async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer2Address);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer3Address); // After this vote, automatically executes the proposal.

        const depositProposalAfterThirdVoteWithExecute = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);

        assert.strictEqual(depositProposalAfterThirdVoteWithExecute._status, STATUS.Executed); // Executed
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(ForwarderInstance.execute(voteCallData, BridgeInstance.address, depositerAddress));
    });

    it("depositProposal shouldn't be voted on if it has a Passed status", async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer2Address);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer3Address);

        await TruffleAssert.reverts(ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer4Address));
    });

    it("relayer shouldn't be able to vote on a depositProposal more than once", async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);
        await TruffleAssert.reverts(ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address));
    });

    it("Relayer's vote using forwarder should be recorded correctly - yes vote", async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);

        const depositProposalAfterFirstVote = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterFirstVote._yesVotesTotal, 1);
        assert.equal(depositProposalAfterFirstVote._yesVotes, relayer1Bit);
        assert.strictEqual(depositProposalAfterFirstVote._status, STATUS.Active);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer2Address);

        const depositProposalAfterSecondVote = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterSecondVote._yesVotesTotal, 2);
        assert.equal(depositProposalAfterSecondVote._yesVotes, relayer1Bit + relayer2Bit);
        assert.strictEqual(depositProposalAfterSecondVote._status, STATUS.Active);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer3Address); // After this vote, automatically executes the proposal.

        const depositProposalAfterThirdVote = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);
        assert.equal(depositProposalAfterThirdVote._yesVotesTotal, 3);
        assert.equal(depositProposalAfterThirdVote._yesVotes, relayer1Bit + relayer2Bit + relayer3Bit);
        assert.strictEqual(depositProposalAfterThirdVote._status, STATUS.Executed); // Executed
    });

    it("Relayer's address that used forwarder should be marked as voted for proposal", async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);

        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, originDomainID), depositDataHash, relayer1Address);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer2Address);

        const voteTx_Forwarder = await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer3Address);
        const voteTx_Bridge = await TruffleAssert.createTransactionResult(BridgeInstance, voteTx_Forwarder.tx);

        TruffleAssert.eventEmitted(voteTx_Bridge, 'ProposalEvent', (event) => {
            return event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === depositDataHash
        });
    });

    it('DepositProposalVote event fired when proposal vote made', async () => {
        const voteTx_Forwarder = await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);
        const voteTx_Bridge = await TruffleAssert.createTransactionResult(BridgeInstance, voteTx_Forwarder.tx);
        TruffleAssert.eventEmitted(voteTx_Bridge, 'ProposalVote', (event) => {
            return event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === 1
        });
    });

    it('Execution successful', async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);

        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer2Address);

        const voteWithExecuteTx_Forwarder = await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer3Address);
        const voteWithExecuteTx_Bridge = await TruffleAssert.createTransactionResult(BridgeInstance, voteWithExecuteTx_Forwarder.tx);

        TruffleAssert.eventEmitted(voteWithExecuteTx_Bridge, 'ProposalEvent', (event) => {
            return event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === depositDataHash
        });
    });

    it('Proposal cannot be executed twice', async () => {
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer1Address);
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer2Address);
        await ForwarderInstance.execute(voteCallData, BridgeInstance.address, relayer3Address); // After this vote, automatically executes the proposal.
        await TruffleAssert.reverts(ForwarderInstance.execute(executeCallData, BridgeInstance.address, relayer1Address));
    });

    it('Execution requires active proposal', async () => {
        await TruffleAssert.reverts(ForwarderInstance.execute(executeCallData, BridgeInstance.address, relayer1Address));
    });
});
