const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('E2E ERC721 - Same Chain', async accounts => {
    const relayerThreshold = 2;
    const chainID = 1;

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
            BridgeContract.new(chainID, [relayer1Address, relayer2Address], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(ERC721MintableInstance.address, chainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC721MintableInstance.address];
        burnableContractAddresses = [];

        ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

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
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        ));

        const record = await ERC721HandlerInstance.getDepositRecord(expectedDepositNonce, chainID)
        assert.strictEqual(record[0], ERC721MintableInstance.address)
        assert.strictEqual(record[1], chainID.toString())
        assert.strictEqual(record[2], resourceID.toLowerCase())
        assert.strictEqual(record[3], recipientAddress.toLowerCase())
        assert.strictEqual(record[4], depositerAddress)
        assert.strictEqual(Number(record[5]), tokenID)
        assert.strictEqual(Ethers.utils.toUtf8String(record[6]), depositMetadata)

        // Handler should have a balance of depositAmount
        const tokenOwner = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(ERC721HandlerInstance.address, tokenOwner);

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
            proposalData,
            resourceID,
            { from: relayer2Address }
        ));

        // Assert ERC721 balance was transferred from depositerAddress
        const tokenOwnerAfterTransfer = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(recipientAddress, tokenOwnerAfterTransfer);
    });
});
