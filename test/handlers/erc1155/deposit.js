/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const ERC1155HandlerContract = artifacts.require("ERC1155Handler");

contract('ERC1155Handler - [Deposit ERC1155]', async (accounts) => {
    const relayerThreshold = 2;
    const domainID = 1;
    const expectedDepositNonce = 1;
    const depositerAddress = accounts[1];
    const tokenID = 1;
    const tokenAmount = 100;

    let BridgeInstance;
    let ERC1155MintableInstance;
    let ERC1155HandlerInstance;

    let resourceID;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC1155MintableContract.new("TOK").then(instance => ERC1155MintableInstance = instance)
        ])
        
        resourceID = Helpers.createResourceID(ERC1155MintableInstance.address, domainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC1155MintableInstance.address];
        burnableContractAddresses = []

        await Promise.all([
            ERC1155HandlerContract.new(BridgeInstance.address).then(instance => ERC1155HandlerInstance = instance),
            ERC1155MintableInstance.mintBatch(depositerAddress, [tokenID], [tokenAmount], "0x0")
        ]);

        await Promise.all([
            ERC1155MintableInstance.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, resourceID, ERC1155MintableInstance.address)
        ]);
        
        depositData = Helpers.createERC1155DepositData([tokenID], [tokenAmount]);
    });

    it('[sanity] depositer owns tokenAmount of tokenID', async () => {
        const depositerBalance = await ERC1155MintableInstance.balanceOf(depositerAddress, tokenID);
        assert.equal(tokenAmount, depositerBalance);
    });

    it('Deposit event is emitted with expected values', async () => {
        const depositTx = await BridgeInstance.deposit(
            domainID,
            resourceID,
            depositData,
            {from: depositerAddress}
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === domainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.data === Helpers.createERC1155DepositData([tokenID], [tokenAmount]).toLowerCase() &&
                event.handlerResponse === null
        });
    });
});
