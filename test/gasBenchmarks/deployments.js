/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const GenericHandlerContract = artifacts.require("GenericHandler");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const HandlerHelpersContract = artifacts.require("HandlerHelpers");
const ERC20SafeContract = artifacts.require("ERC20Safe");
const ERC721SafeContract = artifacts.require("ERC721Safe");

contract('Gas Benchmark - [contract deployments]', async () => {
    const chainID = 1;
    const relayerThreshold = 1;
    const initialResourceIDs = [];
    const initialContractAddresses = [];
    const burnableContractAddresses = [];
    const initialDepositFunctionSignatures = [];
    const initialDepositFunctionDepositerOffsets = [];
    const initialExecuteFunctionSignatures = [];
    const centrifugeAssetMinCount = 1;
    const gasBenchmarks = [];

    let BridgeInstance;

    it('Should deploy all contracts and print benchmarks', async () => {
        let contractInstances = [await BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance)];
        contractInstances = contractInstances.concat(
            await Promise.all([
                ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses),
                ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses),
                GenericHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, initialDepositFunctionSignatures, initialDepositFunctionDepositerOffsets, initialExecuteFunctionSignatures),
                CentrifugeAssetContract.new(centrifugeAssetMinCount),
                HandlerHelpersContract.new(),
                ERC20SafeContract.new(),
                ERC721SafeContract.new()
        ]));

        for (const contractInstance of contractInstances) {
            const txReceipt = await web3.eth.getTransactionReceipt(contractInstance.transactionHash);
            gasBenchmarks.push({
                type: contractInstance.constructor._json.contractName,
                gasUsed: txReceipt.gasUsed
            });
        }

        console.table(gasBenchmarks);
    });
});
