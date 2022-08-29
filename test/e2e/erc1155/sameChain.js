const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");

contract('E2E ERC1155 - Same Chain', async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;

    const adminAddress = accounts[0]
    const depositorAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];


    const tokenID = 1;
    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const feeData = '0x';

    let BridgeInstance;
    let ERC1155MintableInstance;
    let ERC1155HandlerInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    let resourceID;
    let depositData;
    let proposalData;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(destinationDomainID, adminAddress),
            ERC1155MintableContract.new("TOK").then(instance => ERC1155MintableInstance = instance)
        ]);

        resourceID = Helpers.createResourceID(ERC1155MintableInstance.address, originDomainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC1155MintableInstance.address];
        burnableContractAddresses = [];

        ERC1155HandlerInstance = await ERC1155HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC1155MintableInstance.mintBatch(depositorAddress, [tokenID], [initialTokenAmount], "0x0"),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, resourceID, ERC1155MintableInstance.address)
        ]);

        await ERC1155MintableInstance.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositorAddress });

        depositData = Helpers.createERC1155DepositData([tokenID], [depositAmount]);
        proposalData = Helpers.createERC1155DepositProposalData([tokenID], [depositAmount], recipientAddress, "0x");

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("[sanity] depositorAddress' balance should be equal to initialTokenAmount", async () => {
        const depositorBalance = await ERC1155MintableInstance.balanceOf(depositorAddress, tokenID);
        assert.strictEqual(depositorBalance.toNumber(), initialTokenAmount);
    });

    it("depositAmount of Destination ERC1155 should be transferred to recipientAddress", async () => {
        const proposalSignedData = await Helpers.signDataWithMpc(originDomainID, destinationDomainID, expectedDepositNonce, proposalData, resourceID);

        // depositorAddress makes initial deposit of depositAmount
        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        ));

        // Handler should have a balance of depositAmount
        const handlerBalance = await ERC1155MintableInstance.balanceOf(ERC1155HandlerInstance.address, tokenID);
        assert.strictEqual(handlerBalance.toNumber(), depositAmount);

        // relayer1 executes the proposal
        await TruffleAssert.passes(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonce,
            proposalData,
            resourceID,
            proposalSignedData,
            { from: relayer1Address }
        ));

        // Assert ERC1155 balance was transferred from depositorAddress
        const depositorBalance = await ERC1155MintableInstance.balanceOf(depositorAddress, tokenID);
        assert.strictEqual(depositorBalance.toNumber(), initialTokenAmount - depositAmount);

        // Assert ERC1155 balance was transferred to recipientAddress
        const recipientBalance = await ERC1155MintableInstance.balanceOf(recipientAddress, tokenID);
        assert.strictEqual(recipientBalance.toNumber(), depositAmount);
    });

    it("Handler's deposit function can be called by only bridge", async () => {
        await TruffleAssert.reverts(ERC1155HandlerInstance.deposit(resourceID, depositorAddress, depositData, { from: depositorAddress }), "sender must be bridge contract");
    });

    it("Handler's executeProposal function can be called by only bridge", async () => {
        await TruffleAssert.reverts(ERC1155HandlerInstance.executeProposal(resourceID, proposalData, { from: depositorAddress }), "sender must be bridge contract");
    });

    it("Handler's withdraw function can be called by only bridge", async () => {
        let withdrawData;
        withdrawData = Helpers.createERC1155WithdrawData(ERC1155MintableInstance.address, depositorAddress, [tokenID], [depositAmount], "0x");

        await TruffleAssert.reverts(ERC1155HandlerInstance.withdraw(withdrawData, { from: depositorAddress }), "sender must be bridge contract");
    });

    it("Should withdraw funds", async () => {
        let depositorBalance;
        let handlerBalance;
        let withdrawData;

        depositorBalance = await ERC1155MintableInstance.balanceOf(depositorAddress, tokenID);
        assert.equal(depositorBalance, initialTokenAmount);

        await ERC1155MintableInstance.safeTransferFrom(depositorAddress, ERC1155HandlerInstance.address, tokenID, depositAmount, "0x0", { from: depositorAddress });

        depositorBalance = await ERC1155MintableInstance.balanceOf(depositorAddress, tokenID);
        assert.equal(depositorBalance.toNumber(), initialTokenAmount - depositAmount);

        handlerBalance = await ERC1155MintableInstance.balanceOf(ERC1155HandlerInstance.address, tokenID);
        assert.equal(handlerBalance, depositAmount);

        withdrawData = Helpers.createERC1155WithdrawData(ERC1155MintableInstance.address, depositorAddress, [tokenID], [depositAmount], "0x");

        await BridgeInstance.adminWithdraw(ERC1155HandlerInstance.address, withdrawData);

        depositorBalance = await ERC1155MintableInstance.balanceOf(depositorAddress, tokenID);
        assert.equal(depositorBalance, initialTokenAmount);
    });
});
