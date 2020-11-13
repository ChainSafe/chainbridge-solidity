/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('Bridge - [deposit - ERC721]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const originChainTokenID = 42;
    const expectedDepositNonce = 1;
    const genericBytes = '0x736f796c656e745f677265656e5f69735f70656f706c65';
    
    let BridgeInstance;
    let OriginERC721MintableInstance;
    let OriginERC721HandlerInstance;
    let depositData;

    let originResourceID;
    let originInitialResourceIDs;
    let originInitialContractAddresses;
    let originBurnableContractAddresses;
    
    let destinationInitialResourceIDs;
    let destinationInitialContractAddresses;
    let destinationBurnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC721MintableContract.new("token", "TOK", "").then(instance => OriginERC721MintableInstance = instance),
            BridgeContract.new(originChainID, [], 0, 0, 100).then(instance => BridgeInstance = instance)
        ]);
        
        originResourceID = Helpers.createResourceID(OriginERC721MintableInstance.address, originChainID);
        originInitialResourceIDs = [];
        originInitialContractAddresses = [];
        originBurnableContractAddresses =[];
        
        destinationInitialResourceIDs = [];
        destinationInitialContractAddresses = [];
        destinationBurnableContractAddresses = [];

        await Promise.all([
            ERC721HandlerContract.new(BridgeInstance.address, originInitialResourceIDs, originInitialContractAddresses, originBurnableContractAddresses).then(instance => OriginERC721HandlerInstance = instance),
            ERC721HandlerContract.new(BridgeInstance.address, destinationInitialResourceIDs, destinationInitialContractAddresses, destinationBurnableContractAddresses).then(instance => DestinationERC721HandlerInstance = instance)
        ]);

        await Promise.all([
            BridgeInstance.adminSetResource(OriginERC721HandlerInstance.address, originResourceID, OriginERC721MintableInstance.address),
            OriginERC721MintableInstance.mint(depositerAddress, originChainTokenID, genericBytes)
        ]);
        
        await OriginERC721MintableInstance.approve(OriginERC721HandlerInstance.address, originChainTokenID, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(
            originChainTokenID,
            20,
            recipientAddress);
    });

    it("[sanity] test depositerAddress' balance", async () => {
        const originChainDepositerBalance = await OriginERC721MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), 1);
    });

    it(`[sanity] test depositerAddress owns token with ID: ${originChainTokenID}`, async () => {
        const tokenOwner = await OriginERC721MintableInstance.ownerOf(originChainTokenID);
        assert.strictEqual(tokenOwner, depositerAddress);
    });

    it("[sanity] test OriginERC721HandlerInstance.address' allowance", async () => {
        const allowanceHolder = await OriginERC721MintableInstance.getApproved(originChainTokenID);
        assert.strictEqual(allowanceHolder, OriginERC721HandlerInstance.address);
    });

    it('ERC721 deposit can be made', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            originResourceID,
            depositData,
            { from: depositerAddress }
        )
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            originResourceID,
            depositData,
            { from: depositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC721 can be deposited with correct owner and balances', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            originResourceID,
            depositData,
            { from: depositerAddress }
        );

        const tokenOwner = await OriginERC721MintableInstance.ownerOf(originChainTokenID);
        assert.strictEqual(tokenOwner, OriginERC721HandlerInstance.address);

        const originChainDepositerBalance = await OriginERC721MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), 0);

        const originChainHandlerBalance = await OriginERC721MintableInstance.balanceOf(OriginERC721HandlerInstance.address);
        assert.strictEqual(originChainHandlerBalance.toNumber(), 1);
    });

    it('Deposit event is fired with expected value', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationChainID,
            originResourceID,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.resourceID === originResourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});