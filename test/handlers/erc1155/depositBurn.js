/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
 
const TruffleAssert = require('truffle-assertions');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");

contract('ERC1155Handler - [Deposit Burn ERC1155]', async (accounts) => {
    const relayerThreshold = 2;
    const domainID = 1;

    const depositerAddress = accounts[1];

    const tokenID = 1;
    const tokenAmount = 100;

    let BridgeInstance;
    let ERC1155MintableInstance1;
    let ERC1155MintableInstance2;
    let ERC1155HandlerInstance;

    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC1155MintableContract.new("TOK").then(instance => ERC1155MintableInstance1 = instance),
            ERC1155MintableContract.new("TOK").then(instance => ERC1155MintableInstance2 = instance)
        ])

        resourceID1 = Helpers.createResourceID(ERC1155MintableInstance1.address, domainID);
        resourceID2 = Helpers.createResourceID(ERC1155MintableInstance2.address, domainID);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC1155MintableInstance1.address, ERC1155MintableInstance2.address];
        burnableContractAddresses = [ERC1155MintableInstance1.address]

        await Promise.all([
            ERC1155HandlerContract.new(BridgeInstance.address).then(instance => ERC1155HandlerInstance = instance),
            ERC1155MintableInstance1.mintBatch(depositerAddress, [tokenID], [tokenAmount], "0x0")
        ]);
           
        await Promise.all([
            ERC1155MintableInstance1.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, resourceID1, ERC1155MintableInstance1.address),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, resourceID2, ERC1155MintableInstance2.address),
            BridgeInstance.adminSetBurnable(ERC1155HandlerInstance.address, ERC1155MintableInstance1.address),
        ]);

        depositData = Helpers.createERC1155DepositData([tokenID], [tokenAmount]);
   });

    it('[sanity] burnableContractAddresses should be marked true in _burnList', async () => {
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC1155HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });

    it('depositAmount of ERC1155MintableInstance1 tokens should have been burned', async () => {
        await BridgeInstance.deposit(
            domainID,
            resourceID1,
            depositData,
            { from: depositerAddress }
        );

        const handlerBalance = await ERC1155MintableInstance1.balanceOf(ERC1155HandlerInstance.address, tokenID);
        assert.strictEqual(handlerBalance.toNumber(), 0);

        const depositerBalance = await ERC1155MintableInstance1.balanceOf(depositerAddress, tokenID);
        assert.strictEqual(depositerBalance.toNumber(), 0);
    });
});
