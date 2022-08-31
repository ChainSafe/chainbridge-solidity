/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const TruffleAssert = require('truffle-assertions');

 const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('ERC721Handler - [Deposit Burn ERC721]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;

    const depositorAddress = accounts[1];
    const recipientAddress = accounts[2];

    const tokenID = 1;

    const feeData = '0x';

    let BridgeInstance;
    let ERC721MintableInstance1;
    let ERC721MintableInstance2;
    let ERC721HandlerInstance;

    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(originDomainID, accounts[0]),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance1 = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance2 = instance)
        ])

        resourceID1 = Helpers.createResourceID(ERC721MintableInstance1.address, originDomainID);
        resourceID2 = Helpers.createResourceID(ERC721MintableInstance2.address, originDomainID);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC721MintableInstance1.address, ERC721MintableInstance2.address];
        burnableContractAddresses = [ERC721MintableInstance1.address]

        await Promise.all([
            ERC721HandlerContract.new(BridgeInstance.address).then(instance => ERC721HandlerInstance = instance),
            ERC721MintableInstance1.mint(depositorAddress, tokenID, "")
        ]);

        await Promise.all([
            ERC721MintableInstance1.approve(ERC721HandlerInstance.address, tokenID, { from: depositorAddress }),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, resourceID1, ERC721MintableInstance1.address),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, resourceID2, ERC721MintableInstance2.address),
            BridgeInstance.adminSetBurnable(ERC721HandlerInstance.address, ERC721MintableInstance1.address),
        ]);

        depositData = Helpers.createERCDepositData(tokenID, 20, recipientAddress);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it('[sanity] burnableContractAddresses should be marked true in _burnList', async () => {
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC721HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });

    it('[sanity] ERC721MintableInstance1 tokenID has been minted for depositorAddress', async () => {
        const tokenOwner = await ERC721MintableInstance1.ownerOf(tokenID);
        assert.strictEqual(tokenOwner, depositorAddress);
    });

    it('depositAmount of ERC721MintableInstance1 tokens should have been burned', async () => {
        await BridgeInstance.deposit(
            destinationDomainID,
            resourceID1,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        const handlerBalance = await ERC721MintableInstance1.balanceOf(ERC721HandlerInstance.address);
        assert.strictEqual(handlerBalance.toNumber(), 0);

        const depositorBalance = await ERC721MintableInstance1.balanceOf(depositorAddress);
        assert.strictEqual(depositorBalance.toNumber(), 0);

        await TruffleAssert.reverts(
            ERC721MintableInstance1.ownerOf(tokenID),
            'ERC721: owner query for nonexistent token');
    });

    it('depositAmount of ERC721MintableInstance1 tokens should NOT burn from NOT token owner', async () => {
        await TruffleAssert.reverts(BridgeInstance.deposit(
            destinationDomainID,
            resourceID1,
            depositData,
            feeData,
            { from: accounts[3] }
        ),
        'Burn not from owner');
    });
});
