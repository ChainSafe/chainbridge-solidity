/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const BridgeContract = artifacts.require("Bridge");
const AccessControlSegregatorContract = artifacts.require("AccessControlSegregator");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");
const GenericHandlerContract = artifacts.require("GenericHandler");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const HandlerHelpersContract = artifacts.require("HandlerHelpers");
const ERC20SafeContract = artifacts.require("ERC20Safe");
const ERC721SafeContract = artifacts.require("ERC721Safe");
const ERC1155SafeContract = artifacts.require("ERC1155Safe");

contract('Gas Benchmark - [contract deployments]', async (accounts) => {
    const domainID = 1;
    const centrifugeAssetMinCount = 1;
    const gasBenchmarks = [];

    let BridgeInstance;

    it('Should deploy all contracts and print benchmarks', async () => {
       let accessControlInstance = await AccessControlSegregatorContract.new(
            [
                "adminPauseTransfers", "adminUnpauseTransfers", "adminSetResource", "adminSetGenericResource", "adminSetBurnable",
                "adminSetDepositNonce", "adminSetForwarder", "adminChangeAccessControl", "adminChangeFeeHandler", "adminWithdraw",
                "startKeygen", "endKeygen", "refreshKey",
            ],
            Array(13).fill(accounts[0])
        );
        let contractInstances = [accessControlInstance];
        contractInstances = contractInstances.concat(
            await Promise.all([
                await BridgeContract.new(domainID, accessControlInstance.address).then(instance => BridgeInstance = instance),
                ERC20HandlerContract.new(BridgeInstance.address),
                ERC721HandlerContract.new(BridgeInstance.address),
                ERC1155HandlerContract.new(BridgeInstance.address),
                GenericHandlerContract.new(BridgeInstance.address),
                CentrifugeAssetContract.new(centrifugeAssetMinCount),
                HandlerHelpersContract.new(BridgeInstance.address),
                ERC20SafeContract.new(),
                ERC721SafeContract.new(),
                ERC1155SafeContract.new()
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
