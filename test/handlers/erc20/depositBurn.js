/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Deposit Burn ERC20]', async (accounts) => {
    const domainID = 1;

    const depositorAddress = accounts[1];
    const recipientAddress = accounts[2];

    const initialTokenAmount = 100;
    const depositAmount = 10;
    const feeData = '0x';

    let BridgeInstance;
    let ERC20MintableInstance1;
    let ERC20MintableInstance2;
    let ERC20HandlerInstance;

    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(domainID, accounts[0]),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance1 = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance2 = instance)
        ])

        resourceID1 = Helpers.createResourceID(ERC20MintableInstance1.address, domainID);
        resourceID2 = Helpers.createResourceID(ERC20MintableInstance2.address, domainID);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC20MintableInstance1.address, ERC20MintableInstance2.address];
        burnableContractAddresses = [ERC20MintableInstance1.address];

        await Promise.all([
            ERC20HandlerContract.new(BridgeInstance.address).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance1.mint(depositorAddress, initialTokenAmount)
        ]);

        await Promise.all([
            ERC20MintableInstance1.approve(ERC20HandlerInstance.address, depositAmount, { from: depositorAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID1, ERC20MintableInstance1.address),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID2, ERC20MintableInstance2.address),
            BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance1.address)
        ]);

        depositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it('[sanity] burnableContractAddresses should be marked true in _burnList', async () => {
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC20HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });
});
