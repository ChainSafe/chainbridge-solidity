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
    const originChainID = 1;
    const destinationChainID = 1;
    const originChainRelayerAddress = accounts[1];
    const originChainRelayer2Address = accounts[4];
    const originChainRelayer3Address = accounts[5];
    const depositerAddress = accounts[2];
    const destinationChainRecipientAddress = accounts[3];
    const originChainInitialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 2;

    let RelayerInstance;
    let BridgeInstance;
    let OriginERC20MintableInstance;
    let OriginERC20HandlerInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let data = '';
    let dataHash = '';
    let tokenID = '';

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([
            originChainRelayerAddress,
            originChainRelayer2Address,
            originChainRelayer3Address], relayerThreshold);
        BridgeInstance = await BridgeContract.new(originChainID, RelayerInstance.address, relayerThreshold);
        OriginERC20MintableInstance = await ERC20MintableContract.new();
        OriginERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        DestinationERC20MintableInstance = await ERC20MintableContract.new();
        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        tokenID = Ethers.utils.toUtf8Bytes(`0x${destinationChainID}${DestinationERC20MintableInstance.address}`);

        data = '0x' +
            Ethers.utils.hexZeroPad(DestinationERC20HandlerInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(2), 32).substr(2) + // Number of remaining 32byte values (45 bytes padded to 64)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenID), 64).substr(2);
        dataHash = Ethers.utils.keccak256(data);

        await DestinationERC20MintableInstance.addMinter(DestinationERC20HandlerInstance.address);

        await BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress });
    });

    it('[sanity] depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _dataHash: dataHash,
            _yesVotes: [originChainRelayerAddress],
            _noVotes: [],
            _status: '1' // passed
        };

        const depositProposal = await BridgeInstance.getDepositProposal(
            destinationChainID, expectedDepositNonce);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('should vote on depositProposal successfully', async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer2Address }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: depositerAddress }
        ));
    });

    it("depositProposal shouldn't be voted on if it has a Passed status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer2Address }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer3Address }
        ), 'proposal has already been passed or transferred');
    });

    it("depositProposal shouldn't be voted on if it has a Transferred status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer2Address }
        ));
        
        await TruffleAssert.passes(BridgeInstance.executeDepositProposal(
            originChainID,
            expectedDepositNonce,
            DestinationERC20HandlerInstance.address,
            data
        ));

        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer3Address }
        ), 'proposal has already been passed or transferred');
    });

    it("relayer shouldn't be able to vote on a depositProposal more than once", async () => {
        await TruffleAssert.reverts(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ), 'relayer has already voted on proposal');
    });

    it("Relayer's vote should be recorded correctly - yes vote", async () => {
        const depositProposalBeforeSecondVote = await BridgeInstance.getDepositProposal(
            destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalBeforeSecondVote._yesVotes.length, 1);
        assert.deepEqual(depositProposalBeforeSecondVote._yesVotes, [originChainRelayerAddress]);
        assert.strictEqual(depositProposalBeforeSecondVote._noVotes.length, 0);

        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer2Address }
        ));

        const depositProposalAfterSecondVote = await BridgeInstance.getDepositProposal(
            destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterSecondVote._yesVotes.length, 2);
        assert.deepEqual(depositProposalAfterSecondVote._yesVotes, [originChainRelayerAddress, originChainRelayer2Address]);
        assert.strictEqual(depositProposalAfterSecondVote._noVotes.length, 0);
    });

    it("Relayer's address should be marked as voted for proposal", async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer2Address }
        ));

        const hasVoted = await BridgeInstance._hasVotedOnDepositProposal.call(
            destinationChainID, expectedDepositNonce, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('Proposal status should be updated to passed after numYes >= relayerThreshold', async () => {
        await TruffleAssert.passes(BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayer2Address }
        ));

        const depositProposal = await BridgeInstance._depositProposals(
            destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositProposal._status.toNumber(), 2);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        const voteTx = await BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
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
            destinationChainID,
            expectedDepositNonce,
            dataHash,
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
            destinationChainID,
            expectedDepositNonce,
            dataHash,
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
            data,
        )

        TruffleAssert.eventEmitted(executionTx, 'DepositProposalExecuted', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});