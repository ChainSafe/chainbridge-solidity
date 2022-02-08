const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");

contract('E2E ERC1155 - Two EVM Chains', async accounts => {
    const originRelayerThreshold = 2;
    const originDomainID = 1;
    const originRelayer1Address = accounts[3];
    const originRelayer2Address = accounts[4];

    const destinationRelayerThreshold = 2;
    const destinationDomainID = 2;
    const destinationRelayer1Address = accounts[3];
    const destinationRelayer2Address = accounts[4];

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const tokenID = 1;
    const initialTokenAmount = 100;
    const depositAmount = 10; 
    const expectedDepositNonce = 1;

    let OriginBridgeInstance;
    let OriginERC1155MintableInstance;
    let OriginERC1155HandlerInstance
    let originDepositData;
    let originDepositProposalData;
    let originResourceID;
    let originBurnableContractAddresses;

    let DestinationBridgeInstance;
    let DestinationERC1155MintableInstance;
    let DestinationERC1155HandlerInstance;
    let destinationDepositData;
    let destinationDepositProposalData;
    let destinationResourceID;
    let destinationBurnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(originDomainID, [originRelayer1Address, originRelayer2Address], originRelayerThreshold, 0, 100).then(instance => OriginBridgeInstance = instance),
            BridgeContract.new(destinationDomainID, [destinationRelayer1Address, destinationRelayer2Address], destinationRelayerThreshold, 0, 100).then(instance => DestinationBridgeInstance = instance),
            ERC1155MintableContract.new("TOK").then(instance => OriginERC1155MintableInstance = instance),
            ERC1155MintableContract.new("TOK").then(instance => DestinationERC1155MintableInstance = instance)
        ]);
        
        originResourceID = Helpers.createResourceID(OriginERC1155MintableInstance.address, originDomainID);
        originInitialResourceIDs = [originResourceID];
        originInitialContractAddresses = [OriginERC1155MintableInstance.address];
        originBurnableContractAddresses = [];
        
        destinationResourceID = Helpers.createResourceID(DestinationERC1155MintableInstance.address, originDomainID)
        destinationInitialResourceIDs = [destinationResourceID];
        destinationInitialContractAddresses = [DestinationERC1155MintableInstance.address];
        destinationBurnableContractAddresses = [DestinationERC1155MintableInstance.address];

        await Promise.all([
            ERC1155HandlerContract.new(OriginBridgeInstance.address)
                .then(instance => OriginERC1155HandlerInstance = instance),
            ERC1155HandlerContract.new(DestinationBridgeInstance.address)
                .then(instance => DestinationERC1155HandlerInstance = instance)
        ]);

        await OriginERC1155MintableInstance.mintBatch(depositerAddress, [tokenID], [initialTokenAmount], "0x0");

        await Promise.all([
            OriginERC1155MintableInstance.setApprovalForAll(OriginERC1155HandlerInstance.address, true, { from: depositerAddress }),
            DestinationERC1155MintableInstance.grantRole(await DestinationERC1155MintableInstance.MINTER_ROLE(), DestinationERC1155HandlerInstance.address),
            OriginBridgeInstance.adminSetResource(OriginERC1155HandlerInstance.address, originResourceID, OriginERC1155MintableInstance.address),
            DestinationBridgeInstance.adminSetResource(DestinationERC1155HandlerInstance.address, destinationResourceID, DestinationERC1155MintableInstance.address),
            DestinationBridgeInstance.adminSetBurnable(DestinationERC1155HandlerInstance.address, destinationBurnableContractAddresses[0])
        ]);
        
        originDepositData = Helpers.createERC1155DepositData([tokenID], [depositAmount]);
        originDepositProposalData = Helpers.createERC1155DepositProposalData([tokenID], [depositAmount], recipientAddress, "0x");

        destinationDepositData = Helpers.createERC1155DepositData([tokenID], [depositAmount]);
        destinationDepositProposalData = Helpers.createERC1155DepositProposalData([tokenID], [depositAmount], depositerAddress, "0x");
    });

    it("[sanity] depositerAddress' balance of tokenID should be equal to initialTokenAmount", async () => {
        const depositerBalance = await OriginERC1155MintableInstance.balanceOf(depositerAddress, tokenID);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });

    it("[sanity] DestinationERC1155HandlerInstance.address should have minterRole for DestinationERC1155MintableInstance", async () => {
        const isMinter = await DestinationERC1155MintableInstance.hasRole(await DestinationERC1155MintableInstance.MINTER_ROLE(), DestinationERC1155HandlerInstance.address);
        assert.isTrue(isMinter);
    });

    it("E2E: tokenID of Origin ERC1155 owned by depositAddress to Destination ERC1155 owned by recipientAddress and back again", async () => {
        let tokenOwner;

        let depositerBalance;
        let recipientBalance;

        // depositerAddress makes initial deposit of tokenID
        await TruffleAssert.passes(OriginBridgeInstance.deposit(
            destinationDomainID,
            originResourceID,
            originDepositData,
            { from: depositerAddress }
        ));

        depositerBalance = await OriginERC1155MintableInstance.balanceOf(depositerAddress, tokenID);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount - depositAmount);

        // // destinationRelayer1 creates the deposit proposal
        await TruffleAssert.passes(DestinationBridgeInstance.voteProposal(
            originDomainID,
            expectedDepositNonce,
            destinationResourceID,
            originDepositProposalData,
            { from: destinationRelayer1Address }
        ));

        // // destinationRelayer2 votes in favor of the deposit proposal
        // // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // // into a finalized state
        // // and then automatically executes the proposal
        await TruffleAssert.passes(DestinationBridgeInstance.voteProposal(
            originDomainID,
            expectedDepositNonce,
            destinationResourceID,
            originDepositProposalData,
            { from: destinationRelayer2Address }
        ));

        depositerBalance = await OriginERC1155MintableInstance.balanceOf(depositerAddress, tokenID);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount - depositAmount, "depositAmount wasn't transferred from depositerAddress");

        recipientBalance = await DestinationERC1155MintableInstance.balanceOf(recipientAddress, tokenID);
        assert.strictEqual(recipientBalance.toNumber(), depositAmount, "depositAmount wasn't transferred to recipientAddress");

        await DestinationERC1155MintableInstance.setApprovalForAll(DestinationERC1155HandlerInstance.address, true, { from: recipientAddress });

        // recipientAddress makes a deposit of the received depositAmount
        await TruffleAssert.passes(DestinationBridgeInstance.deposit(
            originDomainID,
            destinationResourceID,
            destinationDepositData,
            { from: recipientAddress }
        ));

        // Recipient should have a balance of 0 (deposit amount - deposit amount)
        recipientBalance = await DestinationERC1155MintableInstance.balanceOf(recipientAddress, tokenID);
        assert.strictEqual(recipientBalance.toNumber(), 0);

        // destinationRelayer1 creates the deposit proposal
        await TruffleAssert.passes(OriginBridgeInstance.voteProposal(
            destinationDomainID,
            expectedDepositNonce,
            originResourceID,
            destinationDepositProposalData,
            { from: originRelayer1Address }
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        // and then automatically executes the proposal
        await TruffleAssert.passes(OriginBridgeInstance.voteProposal(
            destinationDomainID,
            expectedDepositNonce,
            originResourceID,
            destinationDepositProposalData,
            { from: originRelayer2Address }
        ));

        recipientBalance = await DestinationERC1155MintableInstance.balanceOf(recipientAddress, tokenID);
        assert.strictEqual(recipientBalance.toNumber(), 0);
        
        depositerBalance = await OriginERC1155MintableInstance.balanceOf(depositerAddress, tokenID);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });
});
