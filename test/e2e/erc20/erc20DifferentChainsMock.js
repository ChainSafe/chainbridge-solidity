const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20Mintable");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('E2E ERC20 - Two EVM Chains', async accounts => {
    const AbiCoder = new Ethers.utils.AbiCoder();

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

    let OriginRelayerInstance;
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
    
    let DestinationRelayerInstance;
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
            RelayerContract.new([originRelayer1Address, originRelayer2Address], originRelayerThreshold).then(instance => OriginRelayerInstance = instance),
            RelayerContract.new([destinationRelayer1Address, destinationRelayer2Address], destinationRelayerThreshold).then(instance => DestinationRelayerInstance = instance),
            ERC20MintableContract.new().then(instance => OriginERC20MintableInstance = instance),
            ERC20MintableContract.new().then(instance => DestinationERC20MintableInstance = instance)
        ]);

        await Promise.all([
            BridgeContract.new(originChainID, OriginRelayerInstance.address, originRelayerThreshold).then(instance => OriginBridgeInstance = instance),
            BridgeContract.new(destinationChainID, DestinationRelayerInstance.address, destinationRelayerThreshold).then(instance => DestinationBridgeInstance = instance)
        ]);

        originResourceID = Ethers.utils.hexZeroPad((OriginERC20MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)
        originInitialResourceIDs = [originResourceID];
        originInitialContractAddresses = [OriginERC20MintableInstance.address];
        originBurnableContractAddresses = [];

        destinationResourceID = Ethers.utils.hexZeroPad((DestinationERC20MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)
        destinationInitialResourceIDs = [destinationResourceID];
        destinationInitialContractAddresses = [DestinationERC20MintableInstance.address];
        destinationBurnableContractAddresses = [];

        await Promise.all([
            ERC20HandlerContract.new(OriginBridgeInstance.address, originInitialResourceIDs, originInitialContractAddresses, originBurnableContractAddresses)
                .then(instance => OriginERC20HandlerInstance = instance),
            ERC20HandlerContract.new(DestinationBridgeInstance.address, destinationInitialResourceIDs, destinationInitialContractAddresses, destinationBurnableContractAddresses)
                .then(instance => DestinationERC20HandlerInstance = instance),
        ]);

        await OriginERC20MintableInstance.mint(depositerAddress, initialTokenAmount);
        await OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount, { from: depositerAddress });
        
        await DestinationERC20MintableInstance.addMinter(DestinationERC20HandlerInstance.address);

        originDepositData = '0x' +
            originResourceID.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +    // Deposit Amount        (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +               // len(recipientAddress) (32 bytes)
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2);                        // recipientAddress      (?? bytes)

        originDepositProposalData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +    // Deposit Amount        (32 bytes) 
            destinationResourceID.substr(2) +                                               // resourceID            (64 bytes) for now
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(20), 32).substr(2) +               // len(recipientAddress) (32 bytes)
            Ethers.utils.hexlify(recipientAddress).substr(2);                               // recipientAddress      (?? bytes)
            
        originDepositProposalDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + originDepositProposalData.substr(2));

        destinationDepositData = '0x' +
            destinationResourceID.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +       // Deposit Amount        (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +                  // len(recipientAddress) (32 bytes)
            Ethers.utils.hexZeroPad(depositerAddress, 32).substr(2);                           // recipientAddress      (?? bytes)

        destinationDepositProposalData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +      // Deposit Amount        (32 bytes) 
            originResourceID.substr(2) +                                                      // resourceID            (64 bytes) for now
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(20), 32).substr(2) +                 // len(recipientAddress) (32 bytes)
            Ethers.utils.hexlify(depositerAddress).substr(2);                                 // recipientAddress      (?? bytes)
            
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
        const isMinter = await DestinationERC20MintableInstance.isMinter(DestinationERC20HandlerInstance.address);
        assert.isTrue(isMinter);
    });

    it("E2E: depositAmount of Origin ERC20 owned by depositAddress to Destination ERC20 owned by recipientAddress and back again", async () => {
        let handlerBalance;
        let depositerBalance;
        let recipientBalance;

        // depositerAddress makes initial deposit of depositAmount
        TruffleAssert.passes(await OriginBridgeInstance.deposit(
            destinationChainID,
            OriginERC20HandlerInstance.address,
            originDepositData,
            { from: depositerAddress }
        ));


        // Handler should have a balance of depositAmount
        handlerBalance = await OriginERC20MintableInstance.balanceOf(OriginERC20HandlerInstance.address);
        assert.strictEqual(handlerBalance.toNumber(), depositAmount, "OriginERC20HandlerInstance.address does not have a balance of depositAmount");


        // destinationRelayer1 creates the deposit proposal
        TruffleAssert.passes(await DestinationBridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            originDepositProposalDataHash,
            { from: destinationRelayer1Address }
        ));


        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await DestinationBridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            originDepositProposalDataHash,
            { from: destinationRelayer2Address }
        ));


        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestinationBridgeInstance.executeDepositProposal(
            originChainID,
            expectedDepositNonce,
            DestinationERC20HandlerInstance.address,
            originDepositProposalData
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
            DestinationERC20HandlerInstance.address,
            destinationDepositData,
            { from: recipientAddress }
        ));

        // Handler should have a balance of depositAmount
        handlerBalance = await DestinationERC20MintableInstance.balanceOf(DestinationERC20HandlerInstance.address);
        assert.strictEqual(handlerBalance.toNumber(), depositAmount);

        // destinationRelayer1 creates the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            destinationDepositProposalDataHash,
            { from: originRelayer1Address }
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await OriginBridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            destinationDepositProposalDataHash,
            { from: originRelayer2Address }
        ));

        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.executeDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            OriginERC20HandlerInstance.address,
            destinationDepositProposalData
        ));

        // Assert ERC20 balance was transferred from recipientAddress
        recipientBalance = await DestinationERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientBalance.toNumber(), 0);
        
        // Assert ERC20 balance was transferred to recipientAddress
        depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });
});
