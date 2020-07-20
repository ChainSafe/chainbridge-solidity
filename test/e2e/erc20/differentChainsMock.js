const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('E2E ERC20 - Two EVM Chains', async accounts => {
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
    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    
    let OriginBridgeInstance;
    let OriginERC20MintableInstance;
    let OriginERC20HandlerInstance;
    let originDepositData;
    let originDepositProposalData;
    let originDepositProposalDataHash;
    let originResourceID;
    let originInitialResourceIDs;
    let originInitialContractAddresses;
    let originBurnableContractAddresses;
    
    let DestinationBridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let destinationDepositData;
    let destinationDepositProposalData;
    let destinationDepositProposalDataHash;
    let destinationResourceID;
    let destinationInitialResourceIDs;
    let destinationInitialContractAddresses;
    let destinationBurnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(originChainID, [originRelayer1Address, originRelayer2Address], originRelayerThreshold, 0, 100).then(instance => OriginBridgeInstance = instance),
            BridgeContract.new(destinationChainID, [destinationRelayer1Address, destinationRelayer2Address], destinationRelayerThreshold, 0, 100).then(instance => DestinationBridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => OriginERC20MintableInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);

        originResourceID = Helpers.createResourceID(OriginERC20MintableInstance.address, originChainID);
        originInitialResourceIDs = [originResourceID];
        originInitialContractAddresses = [OriginERC20MintableInstance.address];
        originBurnableContractAddresses = [OriginERC20MintableInstance.address];

        destinationResourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originChainID);
        destinationInitialResourceIDs = [destinationResourceID];
        destinationInitialContractAddresses = [DestinationERC20MintableInstance.address];
        destinationBurnableContractAddresses = [DestinationERC20MintableInstance.address];

        await Promise.all([
            ERC20HandlerContract.new(OriginBridgeInstance.address, originInitialResourceIDs, originInitialContractAddresses, originBurnableContractAddresses)
                .then(instance => OriginERC20HandlerInstance = instance),
            ERC20HandlerContract.new(DestinationBridgeInstance.address, destinationInitialResourceIDs, destinationInitialContractAddresses, destinationBurnableContractAddresses)
                .then(instance => DestinationERC20HandlerInstance = instance),
        ]);

        await OriginERC20MintableInstance.mint(depositerAddress, initialTokenAmount);

        await Promise.all([
            OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount, { from: depositerAddress }),
            OriginERC20MintableInstance.grantRole(await OriginERC20MintableInstance.MINTER_ROLE(), OriginERC20HandlerInstance.address),
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationERC20HandlerInstance.address),
            OriginBridgeInstance.adminSetResource(OriginERC20HandlerInstance.address, originResourceID, OriginERC20MintableInstance.address),
            DestinationBridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, destinationResourceID, DestinationERC20MintableInstance.address)
        ]);

        originDepositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress);
        originDepositProposalData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress);
        originDepositProposalDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + originDepositProposalData.substr(2));
        
        destinationDepositData = Helpers.createERCDepositData(depositAmount, 20, depositerAddress);
        destinationDepositProposalData = Helpers.createERCDepositData(depositAmount, 20, depositerAddress);
        destinationDepositProposalDataHash = Ethers.utils.keccak256(OriginERC20HandlerInstance.address + destinationDepositProposalData.substr(2));
    });
    
    it("[sanity] depositerAddress' balance should be equal to initialTokenAmount", async () => {
        const depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });

    it("[sanity] OriginERC20HandlerInstance.address should have an allowance of depositAmount from depositerAddress", async () => {
        const handlerAllowance = await OriginERC20MintableInstance.allowance(depositerAddress, OriginERC20HandlerInstance.address);
        assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
    });

    it("[sanity] DestinationERC20HandlerInstance.address should have minterRole for DestinationERC20MintableInstance", async () => {
        const isMinter = await DestinationERC20MintableInstance.hasRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationERC20HandlerInstance.address);
        assert.isTrue(isMinter);
    });

    it("E2E: depositAmount of Origin ERC20 owned by depositAddress to Destination ERC20 owned by recipientAddress and back again", async () => {
        let depositerBalance;
        let recipientBalance;

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
            destinationResourceID,
            { from: destinationRelayer2Address }
        ));


        // Assert ERC20 balance was transferred from depositerAddress
        depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount - depositAmount, "depositAmount wasn't transferred from depositerAddress");

        
        // Assert ERC20 balance was transferred to recipientAddress
        recipientBalance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientBalance.toNumber(), depositAmount, "depositAmount wasn't transferred to recipientAddress");


        // At this point a representation of OriginERC20Mintable has been transferred from
        // depositer to the recipient using Both Bridges and DestinationERC20Mintable.
        // Next we will transfer DestinationERC20Mintable back to the depositer

        await DestinationERC20MintableInstance.approve(DestinationERC20HandlerInstance.address, depositAmount, { from: recipientAddress });

        // recipientAddress makes a deposit of the received depositAmount
        TruffleAssert.passes(await DestinationBridgeInstance.deposit(
            originChainID,
            destinationResourceID,
            destinationDepositData,
            { from: recipientAddress }
        ));

        // Recipient should have a balance of 0 (deposit amount - deposit amount)
        recipientBalance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientBalance.toNumber(), 0);

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
            originResourceID,
            { from: originRelayer2Address }
        ));

        // Assert ERC20 balance was transferred from recipientAddress
        recipientBalance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientBalance.toNumber(), 0);
        
        // Assert ERC20 balance was transferred to recipientAddress
        depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });
});
