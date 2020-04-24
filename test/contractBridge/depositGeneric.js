/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('Bridge - [deposit - Generic]', async (accounts) => {
    const relayerThreshold = 2;
    const originChainID = 1;
    const destinationChainID = 2;
    const recipientAddress = accounts[1];
    const expectedDepositNonce = 1;
    const blankFunctionSig = '0x00000000';
    const centrifugeAssetFuncSig = Ethers.utils.keccak256(Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes('store(bytes32)'))).substr(0, 10);

    let RelayerInstance;
    let BridgeInstance;
    let GenericHandlerInstance;
    let depositData;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialExecuteFunctionSignatures;

    beforeEach(async () => {
        await Promise.all([
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            BridgeInstance = BridgeContract.new(originChainID, [], 0).then(instance => BridgeInstance = instance)
        ]);

        initialResourceIDs = [Ethers.utils.hexZeroPad((CentrifugeAssetInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)];
        initialContractAddresses = [CentrifugeAssetInstance.address];
        initialDepositFunctionSignatures = [blankFunctionSig];
        initialExecuteFunctionSignatures = [centrifugeAssetFuncSig];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address,
            initialResourceIDs,
            initialContractAddresses,
            initialDepositFunctionSignatures,
            initialExecuteFunctionSignatures);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2) +       // recipientAddress      (?? bytes)
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(0), 32).substr(2) // len(metaData) (0 bytes)
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