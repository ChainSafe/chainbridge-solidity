/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('Bridge - [create a deposit proposal (voteProposal) with relayerThreshold = 1]', async (accounts) => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    const originChainRelayerAddress = accounts[1];
    const depositerAddress = accounts[2];
    const destinationRecipientAddress = accounts[3];
    const originChainID = 1;
    const destinationChainID = 2;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 1;

    let RelayerInstance;
    let BridgeInstance;
    let DestBridgeInstance;
    let DestinationERC20MintableInstance;
    let data = '';
    let dataHash = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance),
            BridgeContract.new(originChainID, [originChainRelayerAddress], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            BridgeContract.new(destinationChainID, [originChainRelayerAddress], relayerThreshold, 0).then(instance => DestBridgeInstance = instance)
        ]);

        initialResourceIDs = [
            Ethers.utils.hexZeroPad((DestinationERC20MintableInstance.address + Ethers.utils.hexlify(destinationChainID).substr(2)), 32)
        ];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        data = '0x' +
            Ethers.utils.hexZeroPad(DestinationERC20MintableInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(destinationRecipientAddress, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2);
        dataHash = Ethers.utils.keccak256(data);
    });

    it('should create depositProposal successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: depositerAddress }
        ));
    });

    it("depositProposal shouldn't be created if it has an Active status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it("getProposal should be called successfully", async () => {
        await TruffleAssert.passes(BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce
        ));
    });

    it('depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _dataHash: dataHash,
            _yesVotes: [originChainRelayerAddress],
            _noVotes: [],
            _status: '2' // passed
        };

        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        );

        const depositProposal = await BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('originChainRelayerAddress should be marked as voted for proposal', async () => {
        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        );
        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            destinationChainID, expectedDepositNonce, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalCreated event should be emitted with expected values', async () => {
        const proposalTx = await DestBridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        );

        TruffleAssert.eventEmitted(proposalTx, 'ProposalCreated', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.dataHash === dataHash
        });
    });
});

contract('Bridge - [create a deposit proposal (voteProposal) with relayerThreshold > 1]', async (accounts) => {
    const AbiCoder = new Ethers.utils.AbiCoder();
    
    // const minterAndRelayer = accounts[0];
    const originChainRelayerAddress = accounts[1];
    const depositerAddress = accounts[2];
    const originChainID = 1;
    const destinationChainID = 2;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 2;

    let RelayerInstance;
    let BridgeInstance;
    let DestBridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let data = '';
    let dataHash = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance),
            BridgeContract.new(originChainID, [originChainRelayerAddress], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            BridgeContract.new(destinationChainID, [originChainRelayerAddress], relayerThreshold, 0).then(instance => DestBridgeInstance = instance)
        ]);
        
        initialResourceIDs = [
            Ethers.utils.hexZeroPad((DestinationERC20MintableInstance.address + Ethers.utils.hexlify(destinationChainID).substr(2)), 32)
        ];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        data = '0x' +
            Ethers.utils.hexZeroPad(DestinationERC20MintableInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(DestinationERC20HandlerInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2);
        dataHash = Ethers.utils.keccak256(data);
    });

    it('should create depositProposal successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it('should revert because depositerAddress is not a relayer', async () => {
        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: depositerAddress }
        ));
    });

    it("depositProposal shouldn't be created if it has an Active status", async () => {
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        ));
    });

    it('depositProposal should be created with expected values', async () => {
        const expectedDepositProposal = {
            _dataHash: dataHash,
            _yesVotes: [originChainRelayerAddress],
            _noVotes: [],
            _status: '1' // active
        };

        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        );

        const depositProposal = await BridgeInstance.getProposal(
            destinationChainID, expectedDepositNonce);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it('originChainRelayerAddress should be marked as voted for proposal', async () => {
        await BridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        );
        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            destinationChainID, expectedDepositNonce, originChainRelayerAddress);
        assert.isTrue(hasVoted);
    });

    it('DepositProposalCreated event  should be emitted with expected values', async () => {
        const proposalTx = await DestBridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            dataHash,
            { from: originChainRelayerAddress }
        );

        TruffleAssert.eventEmitted(proposalTx, 'ProposalCreated', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.dataHash === dataHash
        });
    });
});