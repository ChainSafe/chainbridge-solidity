/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Deposit ERC20]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const expectedDepositNonce = 1;
    const depositorAddress = accounts[1];

    const tokenAmount = 100;
    const feeData = '0x';

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let resourceID;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(originDomainID, accounts[0]),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);

        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];
        burnableContractAddresses = []

        await Promise.all([
            ERC20HandlerContract.new(BridgeInstance.address).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance.mint(depositorAddress, tokenAmount)
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, tokenAmount, { from: depositorAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
        ]);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it('[sanity] depositor owns tokenAmount of ERC20', async () => {
        const depositorBalance = await ERC20MintableInstance.balanceOf(depositorAddress);
        assert.equal(tokenAmount, depositorBalance);
    });

    it('[sanity] ERC20HandlerInstance.address has an allowance of tokenAmount from depositorAddress', async () => {
        const handlerAllowance = await ERC20MintableInstance.allowance(depositorAddress, ERC20HandlerInstance.address);
        assert.equal(tokenAmount, handlerAllowance);
    });

    it('Varied recipient address with length 40', async () => {
        const recipientAddress = accounts[0] + accounts[1].substr(2);
        const lenRecipientAddress = 40;

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createERCDepositData(
                    tokenAmount,
                    lenRecipientAddress,
                    recipientAddress).toLowerCase() &&
                event.handlerResponse === null
        });
    });

    it('Varied recipient address with length 32', async () => {
        const recipientAddress = Ethers.utils.keccak256(accounts[0]);
        const lenRecipientAddress = 32;

        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            feeData,
            { from: depositorAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === Helpers.createERCDepositData(
                    tokenAmount,
                    lenRecipientAddress,
                    recipientAddress).toLowerCase() &&
                event.handlerResponse === null
        });
    });

    it("When non-contract addresses are whitelisted in the handler, deposits which the addresses are set as a token address will be failed", async () => {
        const ZERO_Address = "0x0000000000000000000000000000000000000000";
        const EOA_Address = accounts[1];
        const resourceID_ZERO_Address = Helpers.createResourceID(ZERO_Address, originDomainID);
        const resourceID_EOA_Address = Helpers.createResourceID(EOA_Address, originDomainID);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID_ZERO_Address, ZERO_Address);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID_EOA_Address, EOA_Address);

        const recipientAddress = accounts[0] + accounts[1].substr(2);
        const lenRecipientAddress = 40;

        await TruffleAssert.reverts(BridgeInstance.deposit(
            destinationDomainID,
            resourceID_ZERO_Address,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            feeData,
            { from: depositorAddress }
        ), "ERC20: not a contract");

        await TruffleAssert.reverts(BridgeInstance.deposit(
            destinationDomainID,
            resourceID_EOA_Address,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            feeData,
            { from: depositorAddress }
        ), "ERC20: not a contract");
    });
});
