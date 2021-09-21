const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("HandlerRevert");

contract('Bridge - [execute - FailedHandlerExecution]', async accounts => {
    const relayerThreshold = 2;
    const domainID = 1;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let resourceID;
    let depositData;
    let depositProposalData;
    let depositProposalDataHash;

    const STATUS = {
        Inactive : '0',
        Active : '1',
        Passed : '2',
        Executed : '3',
        Cancelled : '4'
    }

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [relayer1Address, relayer2Address], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
    
        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, initialTokenAmount),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
        ]);
        
        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        depositProposalData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        depositProposalDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositProposalData.substr(2));
    });

    it("Should revert if handler execute is reverted", async () => {
        const revertOnFail = true;
        
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer1Address }
        ));

        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer2Address }
        ));

        const depositProposalBeforeFailedExecute = await BridgeInstance.getProposal(
            domainID, expectedDepositNonce, depositProposalDataHash);

        await TruffleAssert.reverts(BridgeInstance.executeProposal(
            domainID,
            expectedDepositNonce,
            depositProposalData,
            resourceID,
            revertOnFail,
            { from: relayer2Address }
        ));

        const depositProposalAfterFailedExecute = await BridgeInstance.getProposal(
            domainID, expectedDepositNonce, depositProposalDataHash);

        assert.deepInclude(Object.assign({}, depositProposalBeforeFailedExecute), depositProposalAfterFailedExecute);
    });

    it("Should not revert even though handler execute is reverted if the proposal's status is changed to Passed during voting. FailedHandlerExecution event should be emitted with expected values. Proposal status still stays on Passed", async () => {        
 
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer1Address }
        ));

        const voteWithExecuteTx = await BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer2Address }
        );

        TruffleAssert.eventEmitted(voteWithExecuteTx, 'FailedHandlerExecution', (event) => {   
            return Ethers.utils.parseBytes32String('0x' + event.lowLevelData.slice(-64)) === 'Something bad happened'
        });

        const depositProposalAfterFailedExecute = await BridgeInstance.getProposal(
            domainID, expectedDepositNonce, depositProposalDataHash);
        
        assert.strictEqual(depositProposalAfterFailedExecute._status, STATUS.Passed);
    });

    it("Vote proposal should be reverted if handler execution is reverted and proposal status was on Passed for vote", async () => {

        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer1Address }
        ));

        // After this vote, automatically executes the proposqal but handler execute is reverted. So proposal still stays on Passed after this vote.
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer2Address }
        ));

        await TruffleAssert.reverts(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer2Address }
        ), 'Something bad happened');
    });

    it("Should execute the proposal successfully if the handler has enough amount after the last execution is reverted", async () => {
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer1Address }
        ));

        // After this vote, automatically executes the proposal but the execution is reverted.
        // But the whole transaction is not reverted and proposal still be on Passed status.
        await TruffleAssert.passes(BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer2Address }
        ));

        // Some virtual operation so that the handler can have enough conditions to be executed.
        await ERC20HandlerInstance.virtualIncreaseBalance(1);

        // Should execute directly in this vote.
        const voteWithExecuteTx = await BridgeInstance.voteProposal(
            domainID,
            expectedDepositNonce,
            resourceID,
            depositProposalData,
            { from: relayer2Address }
        );

        TruffleAssert.eventEmitted(voteWithExecuteTx, 'ProposalEvent', (event) => {
            return event.originDomainID.toNumber() === domainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toString() === STATUS.Executed &&
                event.dataHash === depositProposalDataHash
        });
    })
});
