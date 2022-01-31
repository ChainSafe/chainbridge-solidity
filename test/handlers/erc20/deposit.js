/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('ERC20Handler - [Deposit ERC20]', async (accounts) => {
    const relayerThreshold = 2;
    const domainID = 1;
    const expectedDepositNonce = 1;
    const depositerAddress = accounts[1];
    const tokenAmount = 100;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let resourceID;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];
        burnableContractAddresses = []

        await Promise.all([
            ERC20HandlerContract.new(BridgeInstance.address).then(instance => ERC20HandlerInstance = instance),
            ERC20MintableInstance.mint(depositerAddress, tokenAmount)
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, tokenAmount, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
        ]);
    });

    it('[sanity] depositer owns tokenAmount of ERC20', async () => {
        const depositerBalance = await ERC20MintableInstance.balanceOf(depositerAddress);
        assert.equal(tokenAmount, depositerBalance);
    });

    it('[sanity] ERC20HandlerInstance.address has an allowance of tokenAmount from depositerAddress', async () => {
        const handlerAllowance = await ERC20MintableInstance.allowance(depositerAddress, ERC20HandlerInstance.address);
        assert.equal(tokenAmount, handlerAllowance);
    });

    it('Varied recipient address with length 40', async () => {
        const recipientAddress = accounts[0] + accounts[1].substr(2);
        const lenRecipientAddress = 40;
        
        const depositTx = await BridgeInstance.deposit(
            domainID,
            resourceID,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === domainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositerAddress &&
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
            domainID,
            resourceID,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === domainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositerAddress &&
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
        const resourceID_ZERO_Address = Helpers.createResourceID(ZERO_Address, domainID);
        const resourceID_EOA_Address = Helpers.createResourceID(EOA_Address, domainID);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID_ZERO_Address, ZERO_Address);
        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID_EOA_Address, EOA_Address);

        const recipientAddress = accounts[0] + accounts[1].substr(2);
        const lenRecipientAddress = 40;

        await TruffleAssert.reverts(BridgeInstance.deposit(
            domainID,
            resourceID_ZERO_Address,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress }
        ), "ERC20: not a contract");

        await TruffleAssert.reverts(BridgeInstance.deposit(
            domainID,
            resourceID_EOA_Address,
            Helpers.createERCDepositData(
                tokenAmount,
                lenRecipientAddress,
                recipientAddress),
            { from: depositerAddress }
        ), "ERC20: not a contract");
    });
});

