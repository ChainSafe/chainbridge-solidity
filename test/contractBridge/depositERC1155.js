/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");

contract('Bridge - [deposit - ERC1155]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const adminAddress = accounts[0]
    const depositorAddress = accounts[1];

    const originChainTokenID = 42;
    const originChainInitialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const feeData = '0x';

    let BridgeInstance;
    let OriginERC1155MintableInstance;
    let OriginERC1155HandlerInstance;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            ERC1155MintableContract.new("TOK").then(instance => OriginERC1155MintableInstance = instance),
            BridgeInstance = await Helpers.deployBridge(originDomainID, adminAddress)
        ]);


        resourceID = Helpers.createResourceID(OriginERC1155MintableInstance.address, originDomainID);

        OriginERC1155HandlerInstance = await ERC1155HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            BridgeInstance.adminSetResource(OriginERC1155HandlerInstance.address, resourceID, OriginERC1155MintableInstance.address),
            OriginERC1155MintableInstance.mintBatch(depositorAddress, [originChainTokenID], [originChainInitialTokenAmount], "0x0")
        ]);
        await OriginERC1155MintableInstance.setApprovalForAll(OriginERC1155HandlerInstance.address, true, { from: depositorAddress });

        depositData = Helpers.createERC1155DepositData([originChainTokenID], [depositAmount]);


        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("[sanity] test depositorAddress' balance", async () => {
        const originChainDepositorBalance = await OriginERC1155MintableInstance.balanceOf(depositorAddress, originChainTokenID);
        assert.strictEqual(originChainDepositorBalance.toNumber(), originChainInitialTokenAmount);
    });

    it("[sanity] test OriginERC1155HandlerInstance.address' allowance", async () => {
        const originChainHandlerApprovedStatus = await OriginERC1155MintableInstance.isApprovedForAll(depositorAddress, OriginERC1155HandlerInstance.address);
        assert.strictEqual(originChainHandlerApprovedStatus, true);
    });

    it('ERC1155 deposit can be made', async () => {
        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        ));
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationDomainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC1155 can be deposited with correct balances', async () => {
        await BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        const originChainDepositorBalance = await OriginERC1155MintableInstance.balanceOf(depositorAddress, originChainTokenID);
        assert.strictEqual(originChainDepositorBalance.toNumber(), originChainInitialTokenAmount - depositAmount);

        const originChainHandlerBalance = await OriginERC1155MintableInstance.balanceOf(OriginERC1155HandlerInstance.address, originChainTokenID);
        assert.strictEqual(originChainHandlerBalance.toNumber(), depositAmount);
    });

    it('Deposit event is fired with expected value', async () => {
        let depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce + 1
        });
    });

    it('deposit requires resourceID that is mapped to a handler', async () => {
        await TruffleAssert.reverts(BridgeInstance.deposit(destinationDomainID, '0x0', depositData, feeData, { from: depositorAddress }), "resourceID not mapped to handler");
    });

    it('Deposit destination domain can not be current bridge domain ', async () => {
        await TruffleAssert.reverts(BridgeInstance.deposit(originDomainID, '0x0', depositData, feeData, { from: depositorAddress }), "Can't deposit to current domain");
  });
});
