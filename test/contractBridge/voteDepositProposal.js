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

contract('Bridge - [voteDepositProposal with relayerThreshold == 3]', async (accounts) => {
    const AbiCoder = new Ethers.utils.AbiCoder();

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

    let RelayerInstance;
    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let depositData = '';
    let depositDataHash = '';
    let resourceID = '';
    let initialResourceIDs;
    let initialContractAddresses;

    let vote, executeProposal;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([
                relayer1Address,
                relayer2Address,
                relayer3Address,
                relayer4Address], relayerThreshold).then(instance => RelayerInstance = instance),
            ERC20MintableContract.new().then(instance => DestinationERC20MintableInstance = instance)
        ]);

        BridgeInstance = await BridgeContract.new(destinationChainID, RelayerInstance.address, relayerThreshold);

        resourceID = Ethers.utils.hexZeroPad((DestinationERC20MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)

        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +
            resourceID.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // length of next arg in bytes
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(destinationChainRecipientAddress), 32).substr(2);
        depositDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + depositData.substr(2));

        DestinationERC20MintableInstance.addMinter(DestinationERC20HandlerInstance.address)

        vote = (relayer) => BridgeInstance.voteDepositProposal(originChainID, expectedDepositNonce, depositDataHash, {from: relayer})

        executeProposal = (relayer) => BridgeInstance.executeDepositProposal(originChainID, expectedDepositNonce, DestinationERC20HandlerInstance.address, depositData, {from: relayer})
    });

    it ('[sanity] bridge configured with threshold and relayers', async () => {
        assert.equal(await BridgeInstance._chainID(), destinationChainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal(await RelayerInstance._totalRelayers(), 4)
    })

    it('[sanity] depositProposal should be created with expected values', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const expectedDepositProposal = {
            _dataHash: depositDataHash,
            _yesVotes: [relayer1Address],
            _noVotes: [],
            _status: '1' // Active
        };

        const depositProposal = await BridgeInstance.getDepositProposal(
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

        const depositProposalAfterFirstVote = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterFirstVote._yesVotes.length, 1);
        assert.deepEqual(depositProposalAfterFirstVote._yesVotes, [relayer1Address]);
        assert.strictEqual(depositProposalAfterFirstVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterFirstVote._status, '1');

        await TruffleAssert.passes(vote(relayer2Address));

        const depositProposalAfterSecondVote = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterSecondVote._yesVotes.length, 2);
        assert.deepEqual(depositProposalAfterSecondVote._yesVotes, [relayer1Address, relayer2Address]);
        assert.strictEqual(depositProposalAfterSecondVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterSecondVote._status, '1');

        await TruffleAssert.passes(vote(relayer3Address));

        const depositProposalAfterThirdVote = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterThirdVote._yesVotes.length, 3);
        assert.deepEqual(depositProposalAfterThirdVote._yesVotes, [relayer1Address, relayer2Address, relayer3Address]);
        assert.strictEqual(depositProposalAfterThirdVote._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterThirdVote._status, '2');

        await TruffleAssert.passes(executeProposal(relayer1Address));

        const depositProposalAfterExecute = await BridgeInstance.getDepositProposal(
            originChainID, expectedDepositNonce);
        assert.strictEqual(depositProposalAfterExecute._yesVotes.length, 3);
        assert.deepEqual(depositProposalAfterExecute._yesVotes, [relayer1Address, relayer2Address, relayer3Address]);
        assert.strictEqual(depositProposalAfterExecute._noVotes.length, 0);
        assert.strictEqual(depositProposalAfterExecute._status, '3');
    });

    it("Relayer's address should be marked as voted for proposal", async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        const hasVoted = await BridgeInstance._hasVotedOnDepositProposal.call(
            originChainID, expectedDepositNonce, relayer1Address);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalFinalized', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });

    it('DepositProposalVote event fired when proposal vote made', async () => {
        const voteTx = await vote(relayer1Address);

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalVote', (event) => {
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

        TruffleAssert.eventEmitted(voteTx, 'DepositProposalFinalized', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        const executionTx = await executeProposal(relayer1Address)

        TruffleAssert.eventEmitted(executionTx, 'DepositProposalExecuted', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});