const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('E2E ERC721 - Same Chain', async accounts => {
    const relayerThreshold = 2;
    const domainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const tokenID = 1;
    const depositMetadata = "0xc0ff33";
    const expectedDepositNonce = 1;
    
    let BridgeInstance;
    let ERC721MintableInstance;
    let ERC721HandlerInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    let resourceID;
    let depositData;
    let proposalData;
    let depositProposalDataHash;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [relayer1Address, relayer2Address], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(ERC721MintableInstance.address, domainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC721MintableInstance.address];
        burnableContractAddresses = [];

        ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC721MintableInstance.mint(depositerAddress, tokenID, depositMetadata),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, resourceID, ERC721MintableInstance.address)
        ]);

        await ERC721MintableInstance.approve(ERC721HandlerInstance.address, tokenID, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(tokenID, 20, recipientAddress);
        proposalData = Helpers.createERC721DepositProposalData(tokenID, 20, recipientAddress, depositMetadata.length, depositMetadata);
        depositProposalDataHash = Ethers.utils.keccak256(ERC721HandlerInstance.address + proposalData.substr(2));
    });

    it("[sanity] depositerAddress' should own tokenID", async () => {
        const tokenOwner = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(depositerAddress, tokenOwner);
    });

    it("[sanity] ERC721HandlerInstance.address should have an allowance for tokenID from depositerAddress", async () => {
        const allowedAddress = await ERC721MintableInstance.getApproved(tokenID);
        assert.strictEqual(ERC721HandlerInstance.address, allowedAddress);
    });

    it("depositAmount of Destination ERC721 should be transferred to recipientAddress", async () => {
        // depositerAddress makes initial deposit of depositAmount
        await TruffleAssert.passes(BridgeInstance.deposit(
            domainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        ));

        // Handler should have a balance of depositAmount
        const tokenOwner = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(ERC721HandlerInstance.address, tokenOwner);

        // relayer1 creates the deposit proposal
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            proposalData,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the deposit proposal
        // because the relayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        // and then automatically executes the proposal
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            proposalData,
            { from: relayer2Address }
        ));

        // Assert ERC721 balance was transferred from depositerAddress
        const tokenOwnerAfterTransfer = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(recipientAddress, tokenOwnerAfterTransfer);
    });
});
