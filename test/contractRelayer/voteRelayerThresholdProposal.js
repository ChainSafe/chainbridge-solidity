/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const RelayerContract = artifacts.require("Relayer");

contract('Relayer - [Vote Relayer Threshold Proposal]', async accounts => {
    const relayer1 = accounts[0];
    const relayer2 = accounts[1];
    const relayer3 = accounts[2];
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;
    const proposedThreshold = 1;

    let RelayerInstance;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold);
        await RelayerInstance.createRelayerThresholdProposal(proposedThreshold);
    });

    it('a relayer threshold proposal should correctly count a yes vote', async () => {
        const expectedProposalValues = [
            proposedThreshold,
            [relayer1, relayer2], // _yesVotes
            [],                   // _noVotes
            0                     // _status, 1 == VoteStatus.Active
        ];

        // 1 == Vote.Yes
        await TruffleAssert.passes(RelayerInstance.voteRelayerThresholdProposal(1, { from: relayer2 }));
        
        const thresholdProposal = await RelayerInstance.getCurrentRelayerThresholdProposal();
        let thresholdProposalValues = Object.values(thresholdProposal);
        thresholdProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                thresholdProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(thresholdProposalValues, expectedProposalValues);
    });

    it('a relayer threshold proposal should correctly count a no vote', async () => {
        const expectedProposalValues = [
            proposedThreshold,
            [relayer1], // _yesVotes
            [relayer2], // _noVotes
            1           // _status, 1 == VoteStatus.Active
        ];

        // 1 == Vote.Yes
        await TruffleAssert.passes(RelayerInstance.voteRelayerThresholdProposal(0, { from: relayer2 }));
        
        const thresholdProposal = await RelayerInstance.getCurrentRelayerThresholdProposal();
        let thresholdProposalValues = Object.values(thresholdProposal);
        thresholdProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                thresholdProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(thresholdProposalValues, expectedProposalValues);
    });

    it("should revert because provided vote is invalid", async () => {
        await TruffleAssert.fails(
            RelayerInstance.voteRelayerThresholdProposal(3, { from: relayer2 }),
            TruffleAssert.ErrorType.INVALID_OPCODE);
    });

    it("should revert because there's no active threshold proposal", async () => {
        // 1 == Vote.Yes
        await TruffleAssert.passes(RelayerInstance.voteRelayerThresholdProposal(1, { from: relayer2 }));
        await TruffleAssert.reverts(
            RelayerInstance.voteRelayerThresholdProposal(1),
            'no proposal is currently active');
    });

    it("should revert because relayer has already voted on threshold proposal", async () => {
        // 1 == Vote.Yes
        await TruffleAssert.reverts(
            RelayerInstance.voteRelayerThresholdProposal(1),
            'relayer has already voted');
    });

    it('RelayerThresholdProposalCreated event is emitted when voteRelayerThresholdProposal is called', async () => {
        // 1 == Vote.Yes
        const proposalTx = await RelayerInstance.voteRelayerThresholdProposal(1, { from: relayer2 });
        TruffleAssert.eventEmitted(proposalTx, 'RelayerThresholdProposalVote', event => {
            return event.vote.toNumber() === 1
        });
    });

    it('RelayerThresholdProposalCreated event is emitted when voteRelayerThresholdProposal is called', async () => {
        // 1 == Vote.Yes
        const proposalTx = await RelayerInstance.voteRelayerThresholdProposal(1, { from: relayer2 });
        TruffleAssert.eventEmitted(proposalTx, 'RelayerThresholdChanged', event => {
            return event.newThreshold.toNumber() === proposedThreshold
        });
    });

    it('proposal should go into Inactive status when majority has voted no', async () => {
        const expectedProposalValues = [
            proposedThreshold,
            [relayer1],           // _yesVotes
            [relayer2, relayer3], // _noVotes
            0                     // _status, 1 == VoteStatus.Active
        ];

        // 0 == Vote.No
        await RelayerInstance.voteRelayerThresholdProposal(0, { from: relayer2 });
        await RelayerInstance.voteRelayerThresholdProposal(0, { from: relayer3 });
        
        const thresholdProposal = await RelayerInstance.getCurrentRelayerThresholdProposal();
        let thresholdProposalValues = Object.values(thresholdProposal);
        thresholdProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                thresholdProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(thresholdProposalValues, expectedProposalValues);
    });
});
