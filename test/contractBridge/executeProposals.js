/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');

 const Helpers = require('../helpers');

 const BridgeContract = artifacts.require("Bridge");
 const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
 const ERC20HandlerContract = artifacts.require("ERC20Handler");
 const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
 const ERC721HandlerContract = artifacts.require("ERC721Handler");
 const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
 const ERC1155HandlerContract = artifacts.require("ERC1155Handler");

 contract('Bridge - [execute proposal]', async (accounts) => {
     const destinationDomainID = 1;
     const originDomainID = 2;
     const invalidDestinationDomainID = 3;

     const depositerAddress = accounts[1];
     const recipientAddress = accounts[2];
     const relayer1Address = accounts[3];

     const tokenID = 1;
     const erc721DepositMetadata = "0xf00d";
     const initialTokenAmount = 100;
     const depositAmount = 10;
     const expectedDepositNonces = [1,2,3];
     const feeData = '0x';

     let BridgeInstance;
     let ERC20MintableInstance;
     let ERC20HandlerInstance;
     let ERC721MintableInstance;
     let ERC721HandlerInstance;
     let ERC1155MintableInstance;
     let ERC1155HandlerInstance;

     let erc20ResourceID;
     let erc721ResourceID;
     let erc1155ResourceID;
     let resourceIDs;
     let erc20DepositData;
     let erc20DepositProposalData;
     let erc20DataHash;
     let erc721DepositData;
     let erc721DepositProposalData;
     let erc721DataHash;
     let erc1155DepositData;
     let erc1155DepositProposalData;
     let erc1155DataHash;

     let proposalsForExecution;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(destinationDomainID, accounts[0]),
            ERC20MintableContract.new("ERC20token", "ERC20TOK").then(instance => ERC20MintableInstance = instance),
            ERC721MintableContract.new("ERC721token", "ERC721TOK", "").then(instance => ERC721MintableInstance = instance),
            ERC1155MintableContract.new("ERC1155TOK").then(instance => ERC1155MintableInstance = instance),
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, destinationDomainID),
        erc721ResourceID = Helpers.createResourceID(ERC721MintableInstance.address, destinationDomainID),
        erc1155ResourceID = Helpers.createResourceID(ERC1155MintableInstance.address, destinationDomainID);
        resourceIDs = [erc20ResourceID, erc721ResourceID, erc1155ResourceID];
        contractAddresses = [ERC20MintableInstance.address, ERC721MintableInstance.address, ERC1155MintableInstance.address];

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address);
        ERC1155HandlerInstance = await ERC1155HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, initialTokenAmount),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
            ERC721MintableInstance.grantRole(await ERC721MintableInstance.MINTER_ROLE(), ERC721HandlerInstance.address),
            ERC721MintableInstance.mint(depositerAddress, tokenID, ""),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, erc721ResourceID, ERC721MintableInstance.address),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, erc1155ResourceID, ERC1155MintableInstance.address),
            ERC1155MintableInstance.mintBatch(depositerAddress, [tokenID], [initialTokenAmount], "0x0"),
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress }),
            ERC721MintableInstance.approve(ERC721HandlerInstance.address, tokenID, { from: depositerAddress }),
            ERC1155MintableInstance.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositerAddress })
        ]);

        erc20DepositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        erc20DepositProposalData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        erc20DataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + erc20DepositProposalData.substr(2));

        erc721DepositData = Helpers.createERCDepositData(tokenID, 20, recipientAddress);
        erc721DepositProposalData = Helpers.createERC721DepositProposalData(tokenID, 20, recipientAddress, erc721DepositMetadata.length, erc721DepositMetadata);
        erc721DataHash = Ethers.utils.keccak256(ERC721HandlerInstance.address + erc721DepositProposalData.substr(2));

        erc1155DepositData = Helpers.createERC1155DepositData([tokenID], [depositAmount]);
        erc1155DepositProposalData = Helpers.createERC1155DepositProposalData([tokenID], [depositAmount], recipientAddress, "0x");
        erc1155DataHash = Ethers.utils.keccak256(ERC1155HandlerInstance.address + erc1155DepositProposalData.substr(2));

        proposalsForExecution = [{
          originDomainID: originDomainID,
          depositNonce: expectedDepositNonces[0],
          resourceID: erc20ResourceID,
          data: erc20DepositProposalData
        },
        {
          originDomainID: originDomainID,
          depositNonce: expectedDepositNonces[1],
          resourceID: erc721ResourceID,
          data: erc721DepositProposalData
        },
        {
          originDomainID: originDomainID,
          depositNonce: expectedDepositNonces[2],
          resourceID: erc1155ResourceID,
          data: erc1155DepositProposalData
        }];

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
  });

    it('should create and execute executeProposal successfully', async () => {
        const proposalSignedData = await Helpers.signTypedProposal(BridgeInstance.address, proposalsForExecution);

        // depositerAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc20ResourceID,
            erc20DepositData,
            feeData,
            { from: depositerAddress }
        ));

        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc721ResourceID,
            erc721DepositData,
            feeData,
            { from: depositerAddress }
        ));

        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc1155ResourceID,
            erc1155DepositData,
            feeData,
            { from: depositerAddress }
        ));

        const executeTx = await BridgeInstance.executeProposals(
            proposalsForExecution,
            proposalSignedData,
            { from: relayer1Address }
        );

        await TruffleAssert.passes(executeTx);

        // check that deposit nonces had been marked as used in bitmap
        expectedDepositNonces.forEach(
            async (_,index) => {
              assert.isTrue(await BridgeInstance.isProposalExecuted(originDomainID, expectedDepositNonces[index]));
        });

        // check that tokens are transferred to recipient address
        const recipientERC20Balance = await ERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC20Balance.toNumber(), depositAmount);

        const recipientERC721Balance = await ERC721MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC721Balance.toNumber(), 1);

        const recipientERC1155Balance = await ERC1155MintableInstance.balanceOf(recipientAddress, destinationDomainID);
        assert.strictEqual(recipientERC1155Balance.toNumber(), depositAmount);
    });

    it('should skip executing proposal if deposit nonce is already used', async () => {
        const proposalSignedData = await Helpers.signTypedProposal(BridgeInstance.address, proposalsForExecution);

        // depositerAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc20ResourceID,
            erc20DepositData,
            feeData,
            { from: depositerAddress }
        ));

        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc721ResourceID,
            erc721DepositData,
            feeData,
            { from: depositerAddress }
        ));

        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc1155ResourceID,
            erc1155DepositData,
            feeData,
            { from: depositerAddress }
        ));

        const executeTx = await BridgeInstance.executeProposals(
            proposalsForExecution,
            proposalSignedData,
            { from: relayer1Address }
        );


        await TruffleAssert.passes(executeTx);

        // check that deposit nonces had been marked as used in bitmap
        expectedDepositNonces.forEach(
          async (_,index) => {
              assert.isTrue(await BridgeInstance.isProposalExecuted(originDomainID, expectedDepositNonces[index]));
        });

        // check that tokens are transferred to recipient address
        const recipientERC20Balance = await ERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC20Balance.toNumber(), depositAmount);

        const recipientERC721Balance = await ERC721MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC721Balance.toNumber(), 1);

        const recipientERC1155Balance = await ERC1155MintableInstance.balanceOf(recipientAddress, destinationDomainID);
        assert.strictEqual(recipientERC1155Balance.toNumber(), depositAmount);


        const skipExecuteTx = await BridgeInstance.executeProposals(
          proposalsForExecution,
          proposalSignedData,
          { from: relayer1Address }
          );

          // check that no ProposalExecution events are emitted
          assert.equal(skipExecuteTx.logs.length, 0);
    });

    it('should fail executing proposals if empty array is passed for execution', async () => {
      const proposalSignedData = await Helpers.signTypedProposal(BridgeInstance.address, proposalsForExecution);

      await TruffleAssert.reverts(BridgeInstance.executeProposals(
        [],
        proposalSignedData,
        { from: relayer1Address }
      ), "Proposals can't be an empty array");
    });

    it('executeProposal event should be emitted with expected values', async () => {
        const proposalSignedData = await Helpers.signTypedProposal(BridgeInstance.address, proposalsForExecution);

        // depositerAddress makes initial deposit of depositAmount
        assert.isFalse(await BridgeInstance.paused());
        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc20ResourceID,
            erc20DepositData,
            feeData,
            { from: depositerAddress }
        ));

        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc721ResourceID,
            erc721DepositData,
            feeData,
            { from: depositerAddress }
        ));

        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc1155ResourceID,
            erc1155DepositData,
            feeData,
            { from: depositerAddress }
        ));

        const executeTx = await BridgeInstance.executeProposals(
            proposalsForExecution,
            proposalSignedData,
            { from: relayer1Address }
        );

        TruffleAssert.eventEmitted(executeTx, 'ProposalExecution', (event) => {
            return event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonces[0] &&
                event.dataHash === erc20DataHash
        });

        // check that ProposalExecution has been emitted with expected values for ERC721
        assert.equal(executeTx.logs[1].args.originDomainID, originDomainID);
        assert.equal(executeTx.logs[1].args.depositNonce, expectedDepositNonces[1]);
        assert.equal(executeTx.logs[1].args.dataHash, erc721DataHash);

        // check that ProposalExecution has been emitted with expected values for ERC1155
        assert.equal(executeTx.logs[2].args.originDomainID, originDomainID);
        assert.equal(executeTx.logs[2].args.depositNonce, expectedDepositNonces[2]);
        assert.equal(executeTx.logs[2].args.dataHash, erc1155DataHash);

        // check that deposit nonces had been marked as used in bitmap
        expectedDepositNonces.forEach(
          async (_,index) => {
              assert.isTrue(await BridgeInstance.isProposalExecuted(originDomainID, expectedDepositNonces[index]));
        });

        // check that tokens are transferred to recipient address
        const recipientERC20Balance = await ERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC20Balance.toNumber(), depositAmount);

        const recipientERC721Balance = await ERC721MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC721Balance.toNumber(), 1);

        const recipientERC1155Balance = await ERC1155MintableInstance.balanceOf(recipientAddress, destinationDomainID);
        assert.strictEqual(recipientERC1155Balance.toNumber(), depositAmount);
    });

    it('should fail to executeProposals if signed Proposal has different chainID than the one on which it should be executed', async () => {
      const proposalSignedData = await Helpers.mockSignTypedProposalWithInvalidChainID(BridgeInstance.address, proposalsForExecution);

      // depositerAddress makes initial deposit of depositAmount
      assert.isFalse(await BridgeInstance.paused());
      await TruffleAssert.passes(BridgeInstance.deposit(
          originDomainID,
          erc20ResourceID,
          erc20DepositData,
          feeData,
          { from: depositerAddress }
      ));

      await TruffleAssert.passes(BridgeInstance.deposit(
          originDomainID,
          erc721ResourceID,
          erc721DepositData,
          feeData,
          { from: depositerAddress }
      ));

      await TruffleAssert.passes(BridgeInstance.deposit(
          originDomainID,
          erc1155ResourceID,
          erc1155DepositData,
          feeData,
          { from: depositerAddress }
      ));

      await TruffleAssert.reverts(BridgeInstance.executeProposals(
          proposalsForExecution,
          proposalSignedData,
          { from: relayer1Address }
      ), "Invalid proposal signer");
    });
});
