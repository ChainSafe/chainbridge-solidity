/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20Mintable");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('Bridge - [voteDepositProposal with relayerThreshold > 1]', async (accounts) => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    const originChainID = 1;
    const destinationChainID = 2;
    const originChainRelayerAddress = accounts[0];
    const originChainRelayer2Address = accounts[3];
    const originChainRelayer3Address = accounts[4];
    const depositerAddress = accounts[2];
    const destinationChainRecipientAddress = accounts[3];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 2;

    let RelayerInstance;
    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let depositData = '';
    let depositDataHash = '';
    let resourceID = '';
    let initialResourceIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([
                originChainRelayerAddress,
                originChainRelayer2Address,
                originChainRelayer3Address], relayerThreshold).then(instance => RelayerInstance = instance),
            ERC20MintableContract.new().then(instance => DestinationERC20MintableInstance = instance)
        ]);
            
        BridgeInstance = await BridgeContract.new(destinationChainID, RelayerInstance.address, relayerThreshold);

        resourceID = Ethers.utils.hexZeroPad((DestinationERC20MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)

        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, false);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +
            resourceID.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // length of next arg in bytes
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(destinationChainRecipientAddress), 32).substr(2);
        depositDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + depositData.substr(2));

        await Promise.all([
            DestinationERC20MintableInstance.addMinter(DestinationERC20HandlerInstance.address),
            BridgeInstance.voteDepositProposal(
                originChainID,
                expectedDepositNonce,
                depositDataHash,
                { from: originChainRelayerAddress })
        ]);
    });

    it('[sanity] depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [originChainRelayerAddress],
            _noVotes: [],
            _status: '1' // passed
        };

        const depositProposal = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('should vote on depositProposal successfully', async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: depositerAddress }
        ));
    });

    it("depositProposal shouldn't be voted on if it has a Passed status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer3Address }
        ), 'proposal has already been passed or transferred');
    });

    it("depositProposal shouldn't be voted on if it has a Transferred status", async () => {


        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        ));

        await TruffleAssert.passes(BridgeInstance.executeDepositProposal(
            originChainID,
            expectedDepositNonce,
            DestinationERC20HandlerInstance.address,
            depositData
        ));

        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer3Address }
        ), 'proposal has already been passed or transferred');

    });

    it("relayer shouldn't be able to vote on a depositProposal more than once", async () => {
        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayerAddress }
        ), 'relayer has already voted on proposal');
    });

    it("Relayer's vote should be recorded correctly - yes vote", async () => {
        const depositProposalBeforeSecondVote = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalBeforeSecondVote._yesVotes.length, 1);
        assert.deepEqual(depositProposalBeforeSecondVote._yesVotes, [originChainRelayerAddress]);
        assert.strictEqual(depositProposalBeforeSecondVote._noVotes.length, 0);

        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        ));

        const depositProposalAfterSecondVote = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterSecondVote._yesVotes.length, 2);
        assert.deepEqual(depositProposalAfterSecondVote._yesVotes, [originChainRelayerAddress, originChainRelayer2Address]);
        assert.strictEqual(depositProposalAfterSecondVote._noVotes.length, 0);
    });

    it("Relayer's address should be marked as voted for proposal", async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        ));

        const hasVoted = await BridgeInstance._hasVotedOnDepositProposal.call(
            originChainID, expectedDepositNonce, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('Proposal status should be updated to passed after numYes >= relayerThreshold', async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        ));

        const depositProposal = await BridgeInstance._depositProposals(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposal._status.toNumber(), 2);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        const voteTx = await BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        );

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalFinalized', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });

    it('DepositProposalVote event fired when proposal vote made', async () => {
        const voteTx = await BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        );

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalVote', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === 1
        });
    });

    it('Execution successful', async () => {
        const voteTx = await BridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            depositDataHash,
            { from: originChainRelayer2Address }
        );

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalVote', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === 1
        });

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalFinalized', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        const executionTx = await BridgeInstance.executeDepositProposal(
            originChainID,
            expectedDepositNonce,
            DestinationERC20HandlerInstance.address,
            depositData,
        )

        TruffleAssert.eventEmitted(executionTx, 'DepositProposalExecuted', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});