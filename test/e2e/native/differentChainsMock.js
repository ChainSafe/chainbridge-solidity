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

contract('E2E NativeAsset - [Different Chains Mock]', async accounts => {
    const BN = web3.utils.BN;

    const originRelayerThreshold = 2;
    const originChainID = 1;
    const originRelayer1Address = accounts[3];
    const originRelayer2Address = accounts[4];
    
    const destinationRelayerThreshold = 2;
    const destinationChainID = 2;
    const destinationRelayer1Address = accounts[3];
    const destinationRelayer2Address = accounts[4];
    
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const depositAmount = web3.utils.toWei(new BN(1), 'ether');
    const hexDepositAmount = '0xDE0B6B3A7640000';
    const expectedDepositNonce = 1;
    
    let OriginBridgeInstance;
    let OriginERC20MintableInstance;
    let OriginNativeAssetHandlerInstance;
    let originDepositData;
    let originDepositProposalData;
    let originDepositProposalDataHash;
    let originResourceID;
    let originInitialResourceIDs;
    let originInitialContractAddresses;
    let originBurnableContractAddresses;
    
    let DestinationBridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationNativeAssetHandlerInstance;
    let destinationDepositData;
    let destinationDepositProposalData;
    let destinationDepositProposalDataHash;
    let destinationResourceID;
    let destinationInitialResourceIDs;
    let destinationInitialContractAddresses;
    let destinationBurnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(originChainID, [originRelayer1Address, originRelayer2Address], originRelayerThreshold, 0).then(instance => OriginBridgeInstance = instance),
            BridgeContract.new(destinationChainID, [destinationRelayer1Address, destinationRelayer2Address], destinationRelayerThreshold, 0).then(instance => DestinationBridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => OriginERC20MintableInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);

        originResourceID = Helpers.createResourceID(OriginERC20MintableInstance.address, originChainID);
        originInitialResourceIDs = [originResourceID];
        originInitialContractAddresses = [OriginERC20MintableInstance.address];
        originBurnableContractAddresses = [];

        destinationResourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originChainID);
        destinationInitialResourceIDs = [destinationResourceID];
        destinationInitialContractAddresses = [DestinationERC20MintableInstance.address];
        destinationBurnableContractAddresses = [];

        await Promise.all([
            NativeAssetHandlerContract.new(OriginBridgeInstance.address, originInitialResourceIDs, originInitialContractAddresses, originBurnableContractAddresses)
                .then(instance => OriginNativeAssetHandlerInstance = instance),
            NativeAssetHandlerContract.new(DestinationBridgeInstance.address, destinationInitialResourceIDs, destinationInitialContractAddresses, destinationBurnableContractAddresses)
                .then(instance => DestinationNativeAssetHandlerInstance = instance),
        ]);

        await Promise.all([
            OriginNativeAssetHandlerInstance.depositNative({from: depositerAddress, value: depositAmount}),
            OriginERC20MintableInstance.grantRole(await OriginERC20MintableInstance.MINTER_ROLE(), OriginNativeAssetHandlerInstance.address),
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationNativeAssetHandlerInstance.address),
            OriginBridgeInstance.adminSetHandlerAddress(OriginNativeAssetHandlerInstance.address, originResourceID),
            DestinationBridgeInstance.adminSetHandlerAddress(DestinationNativeAssetHandlerInstance.address, destinationResourceID)
        ]);

        originDepositData = Helpers.createERCDepositData(originResourceID, hexDepositAmount, 32, recipientAddress);
        originDepositProposalData = Helpers.createNativeDepositProposalData(destinationResourceID, hexDepositAmount, depositerAddress, 20, recipientAddress);
        originDepositProposalDataHash = Ethers.utils.keccak256(DestinationNativeAssetHandlerInstance.address + originDepositProposalData.substr(2));
        
        destinationDepositData = Helpers.createERCDepositData(destinationResourceID, hexDepositAmount, 32, depositerAddress);
        destinationDepositProposalData = Helpers.createNativeDepositProposalData(originResourceID, hexDepositAmount, depositerAddress, 20, depositerAddress);
        destinationDepositProposalDataHash = Ethers.utils.keccak256(OriginNativeAssetHandlerInstance.address + destinationDepositProposalData.substr(2));
    });

    it('[sanity] depositer has an available balance of depositAmount in OriginNativeAssetHandlerInstance', async () => {
        const balance = await OriginNativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), depositAmount.toString());
    });

    it('[sanity] recipient should have 0 available balance in OriginNativeAssetHandlerInstance', async () => {
        const balance = await OriginNativeAssetHandlerInstance._availableBalances.call(recipientAddress);
        assert.equal(balance.toString(), '0');
    });

    it("E2E: depositAmount of native asset should be minted for recipient on destinationChain, then released back to depositer on originChain", async () => {
        let balance;

        // depositerAddress makes initial deposit of depositAmount
        TruffleAssert.passes(await OriginBridgeInstance.deposit(
            destinationChainID,
            originResourceID,
            originDepositData,
            { from: depositerAddress }
        ));

        // destinationRelayer1 creates the deposit proposal
        TruffleAssert.passes(await DestinationBridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            destinationResourceID,
            originDepositProposalDataHash,
            { from: destinationRelayer1Address }
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await DestinationBridgeInstance.voteProposal(
            originChainID,
            expectedDepositNonce,
            destinationResourceID,
            originDepositProposalDataHash,
            { from: destinationRelayer2Address }
        ));


        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestinationBridgeInstance.executeProposal(
            originChainID,
            expectedDepositNonce,
            originDepositProposalData,
            { from: destinationRelayer2Address }
        ));

        // Assert depositAmount was minted to recipientAddress
        balance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.equal(balance.toString(), depositAmount.toString());

        // Assert depositerAddress no longer has availableBalance
        balance = await OriginNativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), '0');

        // Assert depositerAddress has lockedBalance of depositAmount
        balance = await OriginNativeAssetHandlerInstance._lockedBalances.call(depositerAddress);
        assert.equal(balance.toString(), depositAmount.toString());

        // At this point a representation of the Origin native asset has been transferred from
        // depositer to the recipient using Both Bridges and DestinationERC20Mintable.
        // Next we will transfer DestinationERC20Mintable back to the depositer

        await DestinationERC20MintableInstance.approve(DestinationNativeAssetHandlerInstance.address, depositAmount, { from: recipientAddress });

        // recipientAddress makes a deposit of the received depositAmount
        TruffleAssert.passes(await DestinationBridgeInstance.deposit(
            originChainID,
            destinationResourceID,
            destinationDepositData,
            { from: recipientAddress }
        ));

        // Recipient should have a balance of 0 (deposit amount - deposit amount)
        balance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(balance.toNumber(), 0);

        // destinationRelayer1 creates the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            originResourceID,
            destinationDepositProposalDataHash,
            { from: originRelayer1Address }
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await OriginBridgeInstance.voteProposal(
            destinationChainID,
            expectedDepositNonce,
            originResourceID,
            destinationDepositProposalDataHash,
            { from: originRelayer2Address }
        ));

        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.executeProposal(
            destinationChainID,
            expectedDepositNonce,
            destinationDepositProposalData,
            { from: originRelayer2Address }
        ));

        // Assert depositAmount was transferred from recipientAddress
        balance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.equal(balance.toString(), '0', 'recipientAddress still has destination tokens');

        // Assert depositerAddress has availableBalance of depositAmount
        balance = await OriginNativeAssetHandlerInstance._availableBalances.call(depositerAddress);
        assert.equal(balance.toString(), depositAmount.toString(), 'depositerAddress does not have depositAmount of native asset');

        // Assert depositerAddress has no lockedBalance of depositAmount
        balance = await OriginNativeAssetHandlerInstance._lockedBalances.call(depositerAddress);
        assert.equal(balance.toString(), '0', 'depositerAddress still has a locked balance of native asset');
    });
});
