/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('Bridge - [deposit - Generic]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const recipientAddress = accounts[1];
    const expectedDepositNonce = 1;
    const genericBytes = '0x736f796c656e745f677265656e5f69735f70656f706c65';

    let RelayerInstance;
    let BridgeInstance;
    let GenericHandlerInstance;
    let depositData;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([], 0);
        BridgeInstance = await BridgeContract.new(originChainID, RelayerInstance.address, 0);
        GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(1), 32).substr(2) + // Number of remaining 32byte values
            Ethers.utils.hexZeroPad(genericBytes, 32).substr(2);
    });

    it('Generic deposit can be made', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            destinationChainID,
            GenericHandlerInstance.address,
            depositData
        ));
    });

    it('_depositCounts is incremented correctly after deposit', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            GenericHandlerInstance.address,
            depositData
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('Generic deposit is stored correctly', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            GenericHandlerInstance.address,
            depositData
        );
        
        const depositRecord = await BridgeInstance._depositRecords.call(destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositRecord, depositData.toLowerCase(), "Stored depositRecord does not match original depositData");
    });

    it('Deposit event is fired with expected value after Generic deposit', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationChainID,
            GenericHandlerInstance.address,
            depositData
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.originChainHandlerAddress === GenericHandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});