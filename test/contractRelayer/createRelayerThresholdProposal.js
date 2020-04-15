/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const RelayerContract = artifacts.require("Relayer");

contract('Relayer - [Create Relayer Threshold Proposal with threshold > 1]', async accounts => {
    const relayer1 = accounts[0];
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;
    const proposedThreshold = 1;

    let RelayerInstance;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold)
    });

    it('a relayer threshold proposal should be created for proposedThreshold with expected values', async () => {
        const expectedProposalValues = [
            proposedThreshold,
            [relayer1], // _yesVotes
            [],         // _noVotes
            1           // _status, 1 == VoteStatus.Active
        ];
        
        await TruffleAssert.passes(RelayerInstance.createRelayerThresholdProposal(proposedThreshold));
        
        const thresholdProposal = await RelayerInstance.getCurrentRelayerThresholdProposal();
        let thresholdProposalValues = Object.values(thresholdProposal);
        thresholdProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                thresholdProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(thresholdProposalValues, expectedProposalValues);
    });

    it("should revert because there's already an active threshold proposal", async () => {
        await TruffleAssert.passes(RelayerInstance.createRelayerThresholdProposal(proposedThreshold));
        await TruffleAssert.reverts(
            RelayerInstance.createRelayerThresholdProposal(proposedThreshold),
            'a proposal is currently active');
    });

    it('should revert because the proposedThreshold is greater then the total number of relayers', async () => {
        await TruffleAssert.reverts(
            RelayerInstance.createRelayerThresholdProposal(initialRelayers.length + 1),
            'proposed value cannot be greater than the total number of relayers');
    });

    it('RelayerThresholdProposalCreated event is emitted when createRelayerThresholdProposal is called', async () => {
        const proposalTx = await RelayerInstance.createRelayerThresholdProposal(proposedThreshold);
        TruffleAssert.eventEmitted(proposalTx, 'RelayerThresholdProposalCreated', event => {
            return event.proposedValue.toNumber() === proposedThreshold
        });
    });
});

contract('Relayer - [Create Relayer Threshold Proposal with threshold = 1]', async accounts => {
    const relayer1 = accounts[0];
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 1;
    const proposedThreshold = 1;

    let RelayerInstance;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold)
    });

    it('a relayer threshold proposal should be created and finalized for proposedThreshold with expected values, and _relayerThreshold should be updated', async () => {
        const expectedProposalValues = [
            proposedThreshold,
            [relayer1], // _yesVotes
            [],         // _noVotes
            0           // _status, 1 == VoteStatus.Active
        ];
        
        await TruffleAssert.passes(RelayerInstance.createRelayerThresholdProposal(proposedThreshold));
        
        const thresholdProposal = await RelayerInstance.getCurrentRelayerThresholdProposal();
        let thresholdProposalValues = Object.values(thresholdProposal);
        thresholdProposalValues.forEach((value, index) => {
            if (typeof value.toNumber !== 'undefined') {
                thresholdProposalValues[index] = value.toNumber();
            }
        });

        assert.deepEqual(thresholdProposalValues, expectedProposalValues);

        const relayerThreshold = await RelayerInstance._relayerThreshold.call();
        assert.equal(proposedThreshold, relayerThreshold);
    });

    it('RelayerThresholdChanged event is emitted when proposal is finalized', async () => {
        const proposalTx = await RelayerInstance.createRelayerThresholdProposal(proposedThreshold);
        TruffleAssert.eventEmitted(proposalTx, 'RelayerThresholdChanged', event => {
            return event.newThreshold.toNumber() === proposedThreshold
        });
    });

    it('RelayerThresholdProposalCreated event is emitted when createRelayerThresholdProposal is called', async () => {
        const proposalTx = await RelayerInstance.createRelayerThresholdProposal(proposedThreshold);
        TruffleAssert.eventEmitted(proposalTx, 'RelayerThresholdProposalCreated', event => {
            return event.proposedValue.toNumber() === proposedThreshold
        });
    });
});
