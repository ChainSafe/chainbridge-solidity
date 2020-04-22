/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const BridgeAssetContract = artifacts.require("BridgeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('Bridge - [deposit - Generic]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const recipientAddress = accounts[1];
    const expectedDepositNonce = 1;

    const bridgeAssetMinCount = 10;
    const hashOfBridgeAsset = Ethers.utils.keccak256('0xc0ffee');
    const bridgeAssetFuncSig = Ethers.utils.keccak256(Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes('store(bytes32)'))).substr(0, 10);

    let RelayerInstance;
    let BridgeInstance;
    let BridgeAssetInstance;
    let GenericHandlerInstance;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([], 0).then(instance => RelayerInstance = instance),
            BridgeAssetContract.new(bridgeAssetMinCount).then(instance => BridgeAssetInstance = instance)
        ]);


        BridgeInstance = await BridgeContract.new(originChainID, RelayerInstance.address, 0);

        initialResourceIDs = [Ethers.utils.hexZeroPad((BridgeAssetInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)];
        initialContractAddresses = [BridgeAssetInstance.address];
        initialFunctionSignatures = [bridgeAssetFuncSig];

        GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, initialFunctionSignatures);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2) +                        // recipientAddress      (?? bytes)
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +               // len(metaData) (32 bytes)
            hashOfBridgeAsset.substr(2);
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
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.originChainHandlerAddress === GenericHandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});