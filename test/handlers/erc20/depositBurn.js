/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Deposit Burn ERC20]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];

    const initialTokenAmount = 100;
    const depositAmount = 10;

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let ERC20HandlerInstance;

    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance2 = instance)
        ])

        resourceID1 = Helpers.createResourceID(ERC20MintableInstance1.address, chainID);
        resourceID2 = Helpers.createResourceID(ERC20MintableInstance2.address, chainID);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address];
        burnableContractAddresses = [ERC20MintableInstance1.address];

        await Promise.all([
            ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance1.mint(depositerAddress, initialTokenAmount)
        ]);

        await Promise.all([
            ERC20MintableInstance1.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress }),
            BridgeInstance.adminSetHandlerAddress(ERC20HandlerInstance.address, resourceID1),
            BridgeInstance.adminSetHandlerAddress(ERC20HandlerInstance.address, resourceID2),
        ]);

        depositData = Helpers.createERCDepositData(resourceID1, depositAmount, 32, recipientAddress);
    });

    it('[sanity] burnableContractAddresses should be marked true in _burnList', async () => {
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC20HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });

    it('[sanity] ERC20HandlerInstance.address should have an allowance of depositAmount from depositerAddress', async () => {
        const handlerAllowance = await ERC20MintableInstance1.allowance(depositerAddress, ERC20HandlerInstance.address);
        assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
    });

    it('depositAmount of ERC20MintableInstance1 tokens should have been burned', async () => {
        await BridgeInstance.deposit(
            chainID,
            resourceID1,
            depositData,
            { from: depositerAddress }
        );

        const handlerAllowance = await ERC20MintableInstance1.allowance(depositerAddress, ERC20HandlerInstance.address);
        assert.strictEqual(handlerAllowance.toNumber(), 0);

        const handlerBalance = await ERC20MintableInstance1.balanceOf(ERC20HandlerInstance.address);
        assert.strictEqual(handlerBalance.toNumber(), 0);

        const zeroAddressBalance = await ERC20MintableInstance1.balanceOf(Ethers.utils.hexZeroPad('0x0', 20));
        assert.strictEqual(zeroAddressBalance.toNumber(), 0);
    });

    it('_burnedTokens for ERC20MintableInstance1.address should have been incremented by depositAmount', async () => {
        await BridgeInstance.deposit(
            chainID,
            resourceID1,
            depositData,
            { from: depositerAddress }
        );

        const numBurnedTokens = await ERC20HandlerInstance._burnedTokens.call(ERC20MintableInstance1.address);
        assert.strictEqual(numBurnedTokens.toNumber(), depositAmount);
    });
});
