/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const RelayerContract = artifacts.require("Relayer");

contract('Relayer - [Relayer Proposal]', async accounts => {
    const relayer1 = accounts[0];
    const relayer2 = accounts[1];
    const relayer3 = accounts[2];
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;
    const proposedRelayerAddress = accounts[3];

    let RelayerInstance;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold)
    });

    it('a relayer proposal should be created for proposedRelayerAddress with expected values', async () => {
        const expectedRelayerProposalValues = [
            1,          // _action, 1 == RelayerActionType.Add
            [relayer1], // _yesVotes
            [],         // _noVotes
            1           // _status, 1 == VoteStatus.Active
        ];
        
        // 1 == RelayerActionType.Add
        await TruffleAssert.passes(RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1));
        
        const relayerProposal = await RelayerInstance.getRelayerProposal(proposedRelayerAddress);
        let relayerProposalValues = Object.values(relayerProposal);
        relayerProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                relayerProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(relayerProposalValues, expectedRelayerProposalValues);
    });

    it('should revert because provided RelayerActionType is out of range', async () => {
        await TruffleAssert.fails(
            RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 2),
            TruffleAssert.ErrorType.INVALID_OPCODE);
    });

    it('should revert because relayer has already voted', async () => {
        // 1 == RelayerActionType.Add
        await TruffleAssert.passes(RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1));
        await TruffleAssert.reverts(
            RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1),
            'relayer has already voted on proposal');
    });

    it('should revert because proposedRelayerAddress is not a relayer', async () => {
        // 0 == RelayerActionType.Remove
        await TruffleAssert.reverts(
            RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 0),
            'proposed address is not a relayer');
    });

    it('should revert because proposedRelayerAddress is already a relayer', async () => {
        // 1 == RelayerActionType.Add
        await TruffleAssert.reverts(
            RelayerInstance.voteRelayerProposal(relayer2, 1, { from: relayer3 }),
            'proposed address is already a relayer');
    });

    it('voteRelayerProposal should emit RelayerProposalCreated event', async () => {
        const proposalVoteTx = await RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1);
        TruffleAssert.eventEmitted(proposalVoteTx, 'RelayerProposalCreated', event => {
            return event.proposedAddress === proposedRelayerAddress &&
                event.relayerActionType.toNumber() === 1
        });
    });

    it('voteRelayerProposal should emit RelayerProposalVote event', async () => {
        // 1 == RelayerActionType.Add
        const proposalVoteTx = await RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1);
        TruffleAssert.eventEmitted(proposalVoteTx, 'RelayerProposalVote', event => {
            return event.proposedAddress === proposedRelayerAddress &&
                event.vote.toNumber() === 1 // 1 == VoteStatus.Active
        });
    });

    it('voteRelayerProposal should emit RelayerAdded event', async () => {
        // 1 == RelayerActionType.Add
        await TruffleAssert.passes(RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1));
        const proposalVoteTx = await RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1, { from: relayer2 });
        TruffleAssert.eventEmitted(proposalVoteTx, 'RelayerAdded', event => {
            return event.relayerAddress === proposedRelayerAddress
        });
    });

    it('voteRelayerProposal should emit RelayerRemoved event', async () => {
        // 1 == RelayerActionType.Add
        await TruffleAssert.passes(RelayerInstance.voteRelayerProposal(relayer2, 0));
        const proposalVoteTx = await RelayerInstance.voteRelayerProposal(relayer2, 0, { from: relayer3 });
        TruffleAssert.eventEmitted(proposalVoteTx, 'RelayerRemoved', event => {
            return event.relayerAddress === relayer2
        });
    });

    it("should set relayer proposal' status to inactive, because relayerProposal._yesVotes >= _relayerThreshold", async () => {
        const expectedRelayerProposalValues = [
            1,                    // _action, 1 == RelayerActionType.Add
            [relayer1, relayer2], // _yesVotes
            [],                   // _noVotes
            0                     // _status, 0 == VoteStatus.Inactive
        ];
        
        // 1 == RelayerActionType.Add
        await RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1);
        await RelayerInstance.voteRelayerProposal(proposedRelayerAddress, 1, { from: relayer2 });
        
        const relayerProposal = await RelayerInstance.getRelayerProposal(proposedRelayerAddress);
        let relayerProposalValues = Object.values(relayerProposal);
        relayerProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                relayerProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(relayerProposalValues, expectedRelayerProposalValues);
    });
});
