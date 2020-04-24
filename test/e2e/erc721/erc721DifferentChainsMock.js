const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('E2E ERC721 - Two EVM Chains', async accounts => {
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
    const tokenID = 1;
    const expectedDepositNonce = 1;

    let OriginBridgeInstance;
    let OriginERC721MintableInstance;
    let OriginERC721HandlerInstance;
    let originDepositData;
    let originDepositProposalData;
    let originDepositProposalDataHash;
    let originResourceID;
    let originBurnableContractAddresses;

    let DestinationBridgeInstance;
    let DestinationERC721MintableInstance;
    let DestinationERC721HandlerInstance;
    let destinationDepositData;
    let destinationDepositProposalData;
    let destinationDepositProposalDataHash;
    let destinationResourceID;
    let destinationBurnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(originChainID, [originRelayer1Address, originRelayer2Address], originRelayerThreshold).then(instance => OriginBridgeInstance = instance),
            BridgeContract.new(destinationChainID, [destinationRelayer1Address, destinationRelayer2Address], destinationRelayerThreshold).then(instance => DestinationBridgeInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => OriginERC721MintableInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => DestinationERC721MintableInstance = instance)
        ]);

        originResourceID = Ethers.utils.hexZeroPad((OriginERC721MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)
        originInitialResourceIDs = [originResourceID];
        originInitialContractAddresses = [OriginERC721MintableInstance.address];
        originBurnableContractAddresses = [];

        destinationResourceID = Ethers.utils.hexZeroPad((DestinationERC721MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)
        destinationInitialResourceIDs = [destinationResourceID];
        destinationInitialContractAddresses = [DestinationERC721MintableInstance.address];
        destinationBurnableContractAddresses = [DestinationERC721MintableInstance.address];

        await Promise.all([
            ERC721HandlerContract.new(OriginBridgeInstance.address, originInitialResourceIDs, originInitialContractAddresses, originBurnableContractAddresses)
                .then(instance => OriginERC721HandlerInstance = instance),
            ERC721HandlerContract.new(DestinationBridgeInstance.address, destinationInitialResourceIDs, destinationInitialContractAddresses, destinationBurnableContractAddresses)
                .then(instance => DestinationERC721HandlerInstance = instance)
        ]);

        await OriginERC721MintableInstance.mint(depositerAddress, tokenID, "");
        await OriginERC721MintableInstance.approve(OriginERC721HandlerInstance.address, tokenID, { from: depositerAddress });

        await DestinationERC721MintableInstance.grantRole(await DestinationERC721MintableInstance.MINTER_ROLE(), DestinationERC721HandlerInstance.address);

        originDepositData = '0x' +
            originResourceID.substr(2) +                                                    // resourceID            (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenID), 32).substr(2) +   // Deposit Amount        (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +  // len(recipientAddress) (32 bytes)
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2);                 // recipientAddress      (?? bytes)

        originDepositProposalData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenID), 32).substr(2) +  // token id             (32 bytes)
            destinationResourceID.substr(2) +                                              // resourceID            (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(20), 32).substr(2) + // len(recipientAddress) (32 bytes)
            Ethers.utils.hexlify(recipientAddress).substr(2) +                             // recipientAddress      (?? bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // len(metaData)         (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(0), 32).substr(2);   // metaData              (?? bytes)

        originDepositProposalDataHash = Ethers.utils.keccak256(DestinationERC721HandlerInstance.address + originDepositProposalData.substr(2));

        destinationDepositData = '0x' +
            destinationResourceID.substr(2) +                                               // resourceID            (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenID), 32).substr(2) +   // token ID              (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +  // len(recipientAddress) (32 bytes)
            Ethers.utils.hexZeroPad(depositerAddress, 32).substr(2);                 // recipientAddress      (?? bytes)

        destinationDepositProposalData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenID), 32).substr(2) +   // Deposit Amount        (32 bytes)
            originResourceID.substr(2) +                                                    // resourceID            (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(20), 32).substr(2) +  // len(recipientAddress) (32 bytes)
            Ethers.utils.hexlify(depositerAddress).substr(2) +                              // recipientAddress      (?? bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +  // len(metaData)         (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(0), 32).substr(2);    // metaData              (?? bytes)

        destinationDepositProposalDataHash = Ethers.utils.keccak256(OriginERC721HandlerInstance.address + destinationDepositProposalData.substr(2));
    });

    it("[sanity] depositerAddress' should own tokenID", async () => {
        const tokenOwner = await OriginERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(depositerAddress, tokenOwner);
    });

    it("[sanity] ERC721HandlerInstance.address should have an allowance for tokenID from depositerAddress", async () => {
        const allowedAddress = await OriginERC721MintableInstance.getApproved(tokenID);
        assert.strictEqual(OriginERC721HandlerInstance.address, allowedAddress);
    });

    it("[sanity] DestinationERC721HandlerInstance.address should have minterRole for DestinationERC721MintableInstance", async () => {
        const isMinter = await DestinationERC721MintableInstance.hasRole(await DestinationERC721MintableInstance.MINTER_ROLE(), DestinationERC721HandlerInstance.address);
        assert.isTrue(isMinter);
    });

    it("E2E: tokenID of Origin ERC721 owned by depositAddress to Destination ERC721 owned by recipientAddress and back again", async () => {
        let tokenOwner;

        // depositerAddress makes initial deposit of tokenID
        TruffleAssert.passes(await OriginBridgeInstance.deposit(
            destinationChainID,
            OriginERC721HandlerInstance.address,
            originDepositData,
            {from: depositerAddress}
        ));

        // Handler should own tokenID
        tokenOwner = await OriginERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(OriginERC721HandlerInstance.address, tokenOwner, "OriginERC721HandlerInstance.address does not own tokenID");

        // destinationRelayer1 creates the deposit proposal
        TruffleAssert.passes(await DestinationBridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            originDepositProposalDataHash,
            {from: destinationRelayer1Address}
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await DestinationBridgeInstance.voteDepositProposal(
            originChainID,
            expectedDepositNonce,
            originDepositProposalDataHash,
            {from: destinationRelayer2Address}
        ));

        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestinationBridgeInstance.executeDepositProposal(
            originChainID,
            expectedDepositNonce,
            DestinationERC721HandlerInstance.address,
            originDepositProposalData,
            {from: destinationRelayer2Address}
        ));

        // Handler should still own tokenID of OriginERC721MintableInstance
        tokenOwner = await OriginERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(OriginERC721HandlerInstance.address, tokenOwner, 'OriginERC721HandlerInstance.address does not own tokenID');

        // Assert ERC721 balance was transferred from depositerAddress
        tokenOwner = await DestinationERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(tokenOwner, recipientAddress, "tokenID wasn't transferred from depositerAddress to recipientAddress");

        // At this point a representation of OriginERC721Mintable has been transferred from
        // depositer to the recipient using Both Bridges and DestinationERC721Mintable.
        // Next we will transfer DestinationERC721Mintable back to the depositer

        await DestinationERC721MintableInstance.approve(DestinationERC721HandlerInstance.address, tokenID, {from: recipientAddress});

        // recipientAddress makes a deposit of the received depositAmount
        TruffleAssert.passes(await DestinationBridgeInstance.deposit(
            originChainID,
            DestinationERC721HandlerInstance.address,
            destinationDepositData,
            {from: recipientAddress}
        ));

        // Token should no longer exist
        TruffleAssert.reverts(DestinationERC721MintableInstance.ownerOf(tokenID), "ERC721: owner query for nonexistent token")

        // destinationRelayer1 creates the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            destinationDepositProposalDataHash,
            {from: originRelayer1Address}
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the destinationRelayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await OriginBridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            destinationDepositProposalDataHash,
            {from: originRelayer2Address}
        ));

        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.executeDepositProposal(
            destinationChainID,
            expectedDepositNonce,
            OriginERC721HandlerInstance.address,
            destinationDepositProposalData,
            {from: originRelayer2Address}
        ));

        // Assert Destination tokenID no longer exists
        TruffleAssert.reverts(DestinationERC721MintableInstance.ownerOf(tokenID), "ERC721: owner query for nonexistent token")

        // Assert DestinationERC721MintableInstance tokenID was transferred to recipientAddress
        tokenOwner = await OriginERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(depositerAddress, tokenOwner, 'OriginERC721MintableInstance tokenID was not transferred back to depositerAddress');
    });
});
