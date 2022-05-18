const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("HandlerRevert");

contract('Bridge - [execute - FailedHandlerExecution]', async accounts => {
    const domainID = 1;
    const destinationDomainID = 2;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const feeData = '0x';

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let resourceID;
    let depositData;
    let depositProposalData;
    let depositProposalDataHash;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);

        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, 10000),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
        ]);

        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, 5000, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        depositProposalData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        depositProposalDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositProposalData.substr(2));

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("Should revert if handler execute is reverted", async () => {
        const revertOnFail = true;

        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
            domainID, expectedDepositNonce);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signDataWithMpc(
          domainID, destinationDomainID, expectedDepositNonce, depositProposalData, resourceID
        );

        await TruffleAssert.reverts(BridgeInstance.executeProposal(
            domainID,
            destinationDomainID,
            expectedDepositNonce,
            depositProposalData,
            resourceID,
            proposalSignedData,
            revertOnFail,
            { from: relayer2Address }
        ));

        const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
           domainID, expectedDepositNonce);

        // depositNonce is not used
        assert.isFalse(depositProposalAfterFailedExecute);
    });
/*
    it("Should not revert even though handler execute is reverted. FailedHandlerExecution event should be emitted with expected values", async () => {
        const proposalSignedData = await Helpers.signDataWithMpc(domainID, destinationDomainID, expectedDepositNonce, depositProposalData, resourceID);

        await TruffleAssert.passes(BridgeInstance.deposit(
          destinationDomainID,
          resourceID,
          depositData,
          feeData,
          { from: depositerAddress }
        ));

        // const executeTx = await BridgeInstance.executeProposal(
        //     domainID,
        //     destinationDomainID,
        //     expectedDepositNonce,
        //     depositProposalData,
        //     resourceID,
        //     proposalSignedData,
        //     { from: relayer1Address }
        // );

        // TruffleAssert.eventEmitted(executeTx, 'FailedHandlerExecution', (event) => {
        //   return Ethers.utils.parseBytes32String('0x' + event.lowLevelData123.slice(-64)) === 'Something bad happened'
        // });

        // const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
        //   domainID, expectedDepositNonce);

        //   assert.isTrue(depositProposalAfterFailedExecute);
    });

    it("Should execute the proposal successfully if the handler has enough amount after the last execution is reverted", async () => {
      const proposalSignedData = await Helpers.signDataWithMpc(
        domainID, destinationDomainID, expectedDepositNonce, depositProposalData, resourceID
      );

      await TruffleAssert.passes(BridgeInstance.deposit(
        destinationDomainID,
        resourceID,
        depositData,
        feeData,
        { from: depositerAddress }
      ));

      // await TruffleAssert.passes(BridgeInstance.executeProposal(
      //     domainID,
      //     destinationDomainID,
      //     expectedDepositNonce,
      //     depositProposalData,
      //     resourceID,
      //     proposalSignedData,
      //     { from: relayer1Address }
      // ));

      // Execution is reverted.
      // But the whole transaction is not reverted.
      // await TruffleAssert.passes(BridgeInstance.executeProposal(
      //     domainID,
      //     destinationDomainID,
      //     expectedDepositNonce,
      //     depositProposalData,
      //     resourceID,
      //     proposalSignedData,
      //     { from: relayer2Address }
      // ));

      // // Some virtual operation so that the handler can have enough conditions to be executed.
      // await ERC20HandlerInstance.virtualIncreaseBalance(1);

      // // Should execute proposal.
      // const executeTx = await BridgeInstance.executeProposal(
      //   domainID,
      //   destinationDomainID,
      //   expectedDepositNonce,
      //   depositProposalData,
      //   resourceID,
      //   proposalSignedData,
      //     { from: relayer2Address }
      // );

      // TruffleAssert.eventEmitted(executeTx, 'ProposalExecution', (event) => {
      //     return event.originDomainID.toNumber() === domainID &&
      //         event.destinationDomainID.toNumber() === destinationDomainID &&
      //         event.depositNonce.toNumber() === expectedDepositNonce &&
      //         event.dataHash === depositProposalDataHash
      // });
  });
  */
});
