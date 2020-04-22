/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const GenericHandlerContract = artifacts.require("GenericHandler");
const BridgeAssetContract = artifacts.require("BridgeAsset");

contract('GenericHandler - [constructor]', async () => {
    const relayerThreshold = 2;
    const chainID = 1;
    const bridgeAssetMinCount = 1;
    const bridgeAssetStoreFuncSig = 'store(bytes32)';

    let RelayerInstance;
    let BridgeInstance;
    let BridgeAssetInstance1;
    let BridgeAssetInstance2;
    let BridgeAssetInstance3;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialFunctionSignatures;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([], relayerThreshold).then(instance => RelayerInstance = instance),
            BridgeAssetContract.new(bridgeAssetMinCount).then(instance => BridgeAssetInstance1 = instance),
            BridgeAssetContract.new(bridgeAssetMinCount).then(instance => BridgeAssetInstance2 = instance),
            BridgeAssetContract.new(bridgeAssetMinCount).then(instance => BridgeAssetInstance3 = instance)
        ]);
        
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);

        initialResourceIDs = [
            Ethers.utils.hexZeroPad((BridgeAssetInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32),
            Ethers.utils.hexZeroPad((BridgeAssetInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32),
            Ethers.utils.hexZeroPad((BridgeAssetInstance3.address + Ethers.utils.hexlify(chainID).substr(2)), 32)
        ];
        burnableContractAddresses = [];
        initialContractAddresses = [BridgeAssetInstance1.address, BridgeAssetInstance2.address, BridgeAssetInstance3.address];
        
        const funcSig = Ethers.utils.keccak256(Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes(bridgeAssetStoreFuncSig))).substr(0, 10);

        initialFunctionSignatures = [
            funcSig, funcSig, funcSig
        ];
    });

    it('[sanity] contract should be deployed successfully', async () => {
        TruffleAssert.passes(await GenericHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, initialFunctionSignatures));
    });

    it('contract mappings were set with expected values', async () => {
        const GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, initialFunctionSignatures);
        
        for (let i = 0; i < initialResourceIDs.length; i++) {
            const retrievedTokenAddress = await GenericHandlerInstance._resourceIDToContractAddress.call(initialResourceIDs[i]);
            assert.strictEqual(initialContractAddresses[i].toLowerCase(), retrievedTokenAddress.toLowerCase());

            const retrievedResourceID = await GenericHandlerInstance._contractAddressToResourceID.call(initialContractAddresses[i]);
            assert.strictEqual(initialResourceIDs[i].toLowerCase(), retrievedResourceID.toLowerCase());

            const retrievedFunctionSig = await GenericHandlerInstance._contractAddressToFunctionSignature.call(initialContractAddresses[i]);
            assert.strictEqual(initialFunctionSignatures[i].toLowerCase(), retrievedFunctionSig.toLowerCase());
        }
    });
});
