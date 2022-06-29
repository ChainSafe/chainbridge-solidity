const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('E2E ERC721 - Same Chain', async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;

    const adminAddress = accounts[0]
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];

    const tokenID = 1;
    const depositMetadata = "0xc0ff33";
    const expectedDepositNonce = 1;
    const feeData = '0x';

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
            BridgeInstance = await Helpers.deployBridge(destinationDomainID, adminAddress),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance = instance)
        ]);

        resourceID = Helpers.createResourceID(ERC721MintableInstance.address, originDomainID);
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

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
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
            originDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositerAddress }
        ));

        // Handler should have a balance of depositAmount
        const tokenOwner = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(ERC721HandlerInstance.address, tokenOwner);

        const proposalSignedData = await Helpers.signDataWithMpc(originDomainID, destinationDomainID, expectedDepositNonce, proposalData, resourceID);

        // relayer1 creates the deposit proposal
        await TruffleAssert.passes(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonce,
            proposalData,
            resourceID,
            proposalSignedData,
            { from: relayer1Address }
        ));

        // Assert ERC721 balance was transferred from depositerAddress
        const tokenOwnerAfterTransfer = await ERC721MintableInstance.ownerOf(tokenID);
        assert.strictEqual(recipientAddress, tokenOwnerAfterTransfer);
    });
});
