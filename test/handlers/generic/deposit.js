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

contract('GenericHandler - [deposit]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];

    const bridgeAssetMinCount = 10;
    const hashOfBridgeAsset = Ethers.utils.keccak256('0xc0ffee');
    const bridgeAssetFuncSig = Ethers.utils.keccak256(Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes('store(bytes32)'))).substr(0, 10);
    const expectedAssetStatus = 1;

    let RelayerInstance;
    let BridgeInstance;
    let BridgeAssetInstance;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialFunctionSignatures;
    let GenericHandlerInstance;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([], relayerThreshold).then(instance => RelayerInstance = instance),
            BridgeAssetContract.new(bridgeAssetMinCount).then(instance => BridgeAssetInstance = instance)
        ]);
        
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        
        initialResourceIDs = [Ethers.utils.hexZeroPad((BridgeAssetInstance.address + Ethers.utils.hexlify(chainID).substr(2)), 32)];
        initialContractAddresses = [BridgeAssetInstance.address];
        initialFunctionSignatures = [bridgeAssetFuncSig];

        GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, initialFunctionSignatures);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2) +                        // recipientAddress      (?? bytes)
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +               // len(metaData) (32 bytes)
            hashOfBridgeAsset.substr(2);
    });

    it('deposit can be made successfully', async () => {
        await BridgeInstance.deposit(
            chainID,
            GenericHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const currentAssetStatus = await BridgeAssetInstance.assets.call(hashOfBridgeAsset);
        assert.equal(currentAssetStatus.toNumber(), expectedAssetStatus);
    });
});
