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
                10,).then(instance => BridgeInstance = instance),
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
        executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedDepositNonce, depositData, { from: relayer });
    });

    it ('[sanity] bridge configured with threshold, relayers, and expiry', async () => {
        assert.equal(await BridgeInstance._chainID(), destinationChainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')

        assert.equal(await BridgeInstance._expiry(), 10)
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


    it("voting on depositProposal after threshold results in cancelled proposal", async () => {
        

        await TruffleAssert.passes(vote(relayer1Address));

        for (i=0; i<10; i++) {
            await Helpers.advanceBlock();
        }

        await TruffleAssert.passes(vote(relayer2Address));
        
        const expectedDepositProposal = {
            _yesVotes: relayer1Bit.toString(),
            _yesVotesTotal: '1',
            _status: '4' // Cancelled
        };

        const depositProposal = await BridgeInstance.getProposal(originChainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
        await TruffleAssert.reverts(vote(relayer3Address), "proposal already passed/executed/cancelled.")
    });


    it("relayer can cancel proposal after threshold blocks have passed", async () => {
        await TruffleAssert.passes(vote(relayer2Address));

        for (i=0; i<10; i++) {
            await Helpers.advanceBlock();
        }

        const expectedDepositProposal = {
            _yesVotes: relayer2Bit.toString(),
            _yesVotesTotal: '1',
            _status: '4' // Cancelled
        };

        await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash))
        const depositProposal = await BridgeInstance.getProposal(originChainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
        await TruffleAssert.reverts(vote(relayer4Address), "proposal already passed/executed/cancelled.")
    });

    it("relayer cannot cancel proposal before threshold blocks have passed", async () => {
        await TruffleAssert.passes(vote(relayer2Address));

        await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash), "Proposal not at expiry threshold")
    });

    it("admin can cancel proposal after threshold blocks have passed", async () => {
        await TruffleAssert.passes(vote(relayer3Address));

        for (i=0; i<10; i++) {
            await Helpers.advanceBlock();
        }

        const expectedDepositProposal = {
            _yesVotes: relayer3Bit.toString(),
            _yesVotesTotal: '1',
            _status: '4' // Cancelled
        };

        await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash))
        const depositProposal = await BridgeInstance.getProposal(originChainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
        await TruffleAssert.reverts(vote(relayer2Address), "proposal already passed/executed/cancelled.")
    });

    it("proposal cannot be cancelled twice", async () => {
        await TruffleAssert.passes(vote(relayer3Address));

        for (i=0; i<10; i++) {
            await Helpers.advanceBlock();
        }

        await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash))
        await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash), "Proposal cannot be cancelled")
    });

    it("inactive proposal cannot be cancelled", async () => {
        await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash), "Proposal cannot be cancelled")
    });

    it("executed proposal cannot be cancelled", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));

        await TruffleAssert.passes(BridgeInstance.executeProposal(originChainID, expectedDepositNonce, depositData, resourceID));
        await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedDepositNonce, depositDataHash), "Proposal cannot be cancelled")
    });

});
