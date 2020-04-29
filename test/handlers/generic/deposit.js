/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('GenericHandler - [deposit]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    
    const blankFunctionSig = '0x00000000';
    const centrifugeAssetFuncSig = Ethers.utils.keccak256(Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes('store(bytes32)'))).substr(0, 10);
    const expectedDepositNonce = 1;

    let BridgeInstance;
    let CentrifugeAssetInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialExecuteFunctionSignatures;
    let GenericHandlerInstance;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance)
        ]);

        initialResourceIDs = [Ethers.utils.hexZeroPad((CentrifugeAssetInstance.address + Ethers.utils.hexlify(chainID).substr(2)), 32)];
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
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(4), 32).substr(2) + // len(metaData) (32 bytes)
            Ethers.utils.hexZeroPad('0xdeadbeef', 4).substr(2) // metadata (4 bytes)
    });

    it('deposit can be made successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));
    });

    it('depositRecord is created with expected values', async () => {
        const expectedDepositRecord = {
            _destinationChainID: chainID,
            _resourceID: initialResourceIDs[0],
            _depositer: depositerAddress,
            _metaData: '0xdeadbeef'
        };

        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));

        const retrievedDepositRecord = await GenericHandlerInstance._depositRecords.call(expectedDepositNonce, chainID);
        assert.containsAllKeys(retrievedDepositRecord, Object.keys(expectedDepositRecord));

        for(const depositRecordProperty of Object.keys(expectedDepositRecord)) {
            let retrievedValue = retrievedDepositRecord[depositRecordProperty];
            let expectedValue = expectedDepositRecord[depositRecordProperty];
            
            retrievedValue = retrievedValue != null && retrievedValue.toNumber ? retrievedValue.toNumber() : retrievedValue;
            retrievedValue = retrievedValue != null && retrievedValue.toLowerCase ? retrievedValue.toLowerCase() : retrievedValue;
            expectedValue = expectedValue != null && expectedValue.toLowerCase ? expectedValue.toLowerCase() : expectedValue;

            assert.equal(retrievedValue, expectedValue,
                `expected ${depositRecordProperty} does not match retrieved value`);
        }
    });
});
