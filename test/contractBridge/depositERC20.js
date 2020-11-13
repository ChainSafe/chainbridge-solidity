/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('Bridge - [deposit - ERC20]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const relayerThreshold = 0;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const originChainInitialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    
    let BridgeInstance;
    let OriginERC20MintableInstance;
    let OriginERC20HandlerInstance;
    let depositData;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC20MintableContract.new("token", "TOK").then(instance => OriginERC20MintableInstance = instance),
            BridgeInstance = await BridgeContract.new(originChainID, [], relayerThreshold, 0, 100)
        ]);
        
        
        resourceID = Helpers.createResourceID(OriginERC20MintableInstance.address, originChainID);
        initialResourceIDs = [];
        initialContractAddresses = [];
        burnableContractAddresses = [];

        OriginERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);

        await Promise.all([
            BridgeInstance.adminSetResource(OriginERC20HandlerInstance.address, resourceID, OriginERC20MintableInstance.address),
            OriginERC20MintableInstance.mint(depositerAddress, originChainInitialTokenAmount)
        ]);
        await OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount * 2, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(
            depositAmount,
            20,
            recipientAddress);
    });

    it("[sanity] test depositerAddress' balance", async () => {
        const originChainDepositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), originChainInitialTokenAmount);
    });

    it("[sanity] test OriginERC20HandlerInstance.address' allowance", async () => {
        const originChainHandlerAllowance = await OriginERC20MintableInstance.allowance(depositerAddress, OriginERC20HandlerInstance.address);
        assert.strictEqual(originChainHandlerAllowance.toNumber(), depositAmount * 2);
    });

    it('ERC20 deposit can be made', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        ));
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC20 can be deposited with correct balances', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        const originChainDepositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), originChainInitialTokenAmount - depositAmount);

        const originChainHandlerBalance = await OriginERC20MintableInstance.balanceOf(OriginERC20HandlerInstance.address);
        assert.strictEqual(originChainHandlerBalance.toNumber(), depositAmount);
    });

    it('Deposit event is fired with expected value', async () => {
        let depositTx = await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        depositTx = await BridgeInstance.deposit(
            destinationChainID,
            resourceID,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce + 1
        });
    });

    it('deposit requires resourceID that is mapped to a handler', async () => {
        await TruffleAssert.reverts(BridgeInstance.deposit(destinationChainID, '0x0', depositData, { from: depositerAddress }), "resourceID not mapped to handler");
    });
});
