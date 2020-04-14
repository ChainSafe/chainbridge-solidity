/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20Mintable");
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

    let RelayerInstance;
    let BridgeInstance;
    let OriginERC20MintableInstance;
    let OriginERC20HandlerInstance;
    let depositData;
    let initialTokenIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        const AbiCoder = new Ethers.utils.AbiCoder();

        await Promise.all([
            RelayerContract.new([], relayerThreshold).then(instance => RelayerInstance = instance),
            ERC20MintableContract.new().then(instance => OriginERC20MintableInstance = instance)
        ]);
        
        BridgeInstance = await BridgeContract.new(originChainID, RelayerInstance.address, relayerThreshold);

        tokenID = AbiCoder.encode(['uint256', 'address'], [originChainID, OriginERC20MintableInstance.address]);
        initialTokenIDs = [tokenID];
        initialContractAddresses = [OriginERC20MintableInstance.address];

        OriginERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialTokenIDs, initialContractAddresses, false);

        await OriginERC20MintableInstance.mint(depositerAddress, originChainInitialTokenAmount);
        await OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount * 2, { from: depositerAddress });

        depositData = '0x' +
            Ethers.utils.hexZeroPad(OriginERC20MintableInstance.address, 32).substr(2) +  // OriginHandlerAddress  (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +  // Deposit Amount        (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(20), 32).substr(2) +             // len(recipientAddress) (32 bytes)
            Ethers.utils.hexlify(recipientAddress).substr(2);                             // recipientAddress      (?? bytes)
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
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC20 can be deposited with correct balances', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const originChainDepositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), originChainInitialTokenAmount - depositAmount);

        const originChainHandlerBalance = await OriginERC20MintableInstance.balanceOf(OriginERC20HandlerInstance.address);
        assert.strictEqual(originChainHandlerBalance.toNumber(), depositAmount);
    });

    it('depositRecord is created with expected depositNonce and correct value', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const depositRecord = await BridgeInstance._depositRecords.call(destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositRecord, depositData.toLowerCase(), "Stored depositRecord does not match original depositData");
    });

    it('Deposit event is fired with expected value', async () => {
        let depositTx = await BridgeInstance.deposit(
            destinationChainID,
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.originChainHandlerAddress === OriginERC20HandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });

        depositTx = await BridgeInstance.deposit(
            destinationChainID,
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.originChainHandlerAddress === OriginERC20HandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositNonce + 1
        });
    });
});