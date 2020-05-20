/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const NativeAssetHandlerContract = artifacts.require("NativeAssetHandler");

contract('E2E NativeAsset - [Same Chain]', async (accounts) => {
    const BN = web3.utils.BN;

    const relayerThreshold = 2;
    const chainID = 1;
    const expectedDepositNonce = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const initialRelayers = [relayer1Address, relayer2Address];
    const depositAmount = web3.utils.toWei(new BN(1), 'ether');
    const hexDepositAmount = '0xDE0B6B3A7640000';
    
    let BridgeInstance;
    let ERC20MintableInstance;
    let NativeAssetHandlerInstance;
    
    let resourceID;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, initialRelayers, relayerThreshold, 0).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
        ]);
        
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];
        burnableContractAddresses = []

        NativeAssetHandlerInstance = await NativeAssetHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        await Promise.all([
            BridgeInstance.adminSetHandlerAddress(NativeAssetHandlerInstance.address, resourceID),
            NativeAssetHandlerInstance.depositNative({from: depositerAddress, value: depositAmount})
        ]);

        depositData = Helpers.createERCDepositData(resourceID, hexDepositAmount, 32, recipientAddress)
        depositProposalData = Helpers.createNativeDepositProposalData(resourceID, hexDepositAmount, depositerAddress, 20, recipientAddress);
        depositProposalDataHash = Ethers.utils.keccak256(NativeAssetHandlerInstance.address + depositProposalData.substr(2));
    });

    it('[sanity] depositer has an available balance of depositAmount in NativeAssetHandlerInstance', async () => {
        const balance = await NativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), depositAmount.toString());
    });

    it('[sanity] recipientAddress should have 0 available balance in NativeAssetHandlerInstance', async () => {
        const balance = await NativeAssetHandlerInstance._availableBalances.call(recipientAddress);
        assert.equal(balance.toString(), '0');
    });

    it("depositAmount of Destination ERC20 should be transferred to recipientAddress", async () => {
        // depositerAddress makes initial deposit of depositAmount
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        ));

        // Depositer should have a locked balance of depositAmount
        const depositerLockedBalance = await NativeAssetHandlerInstance._lockedBalances.call(depositerAddress);
        assert.strictEqual(depositerLockedBalance.toString(), depositAmount.toString());

        // relayer1 creates the deposit proposal
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            chainID,
            expectedDepositNonce,
            resourceID,
            depositProposalDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the deposit proposal
        // because the relayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await BridgeInstance.voteProposal(
            chainID,
            expectedDepositNonce,
            resourceID,
            depositProposalDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await BridgeInstance.executeProposal(
            chainID,
            expectedDepositNonce,
            depositProposalData,
            { from: relayer2Address }
        ));

        let balance;

        // Assert depositAmount was release to recipientAddress
        balance = await NativeAssetHandlerInstance._availableBalances.call(recipientAddress);
        assert.equal(balance.toString(), depositAmount.toString());

        // Assert depositerAddress no longer has availableBalance
        balance = await NativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), '0');

        // Assert depositerAddress no longer has lockedBalance
        balance = await NativeAssetHandlerInstance._lockedBalances.call(depositerAddress);
        assert.equal(balance.toString(), '0');
    });
});
