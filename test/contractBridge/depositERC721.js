/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('Bridge - [deposit - ERC721]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const adminAddress = accounts[0]
    const depositorAddress = accounts[1];
    const recipientAddress = accounts[2];

    const originChainTokenID = 42;
    const expectedDepositNonce = 1;
    const genericBytes = '0x736f796c656e745f677265656e5f69735f70656f706c65';
    const feeData = '0x';

    let BridgeInstance;
    let OriginERC721MintableInstance;
    let OriginERC721HandlerInstance;
    let depositData;

    let originResourceID;

    beforeEach(async () => {
        await Promise.all([
            ERC721MintableContract.new("token", "TOK", "").then(instance => OriginERC721MintableInstance = instance),
            BridgeInstance = await Helpers.deployBridge(originDomainID, adminAddress)
        ]);

        originResourceID = Helpers.createResourceID(OriginERC721MintableInstance.address, originDomainID);

        await Promise.all([
            ERC721HandlerContract.new(BridgeInstance.address).then(instance => OriginERC721HandlerInstance = instance),
            ERC721HandlerContract.new(BridgeInstance.address).then(instance => DestinationERC721HandlerInstance = instance)
        ]);

        await Promise.all([
            BridgeInstance.adminSetResource(OriginERC721HandlerInstance.address, originResourceID, OriginERC721MintableInstance.address),
            OriginERC721MintableInstance.mint(depositorAddress, originChainTokenID, genericBytes)
        ]);

        await OriginERC721MintableInstance.approve(OriginERC721HandlerInstance.address, originChainTokenID, { from: depositorAddress });

        depositData = Helpers.createERCDepositData(
            originChainTokenID,
            20,
            recipientAddress);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("[sanity] test depositorAddress' balance", async () => {
        const originChainDepositorBalance = await OriginERC721MintableInstance.balanceOf(depositorAddress);
        assert.strictEqual(originChainDepositorBalance.toNumber(), 1);
    });

    it(`[sanity] test depositorAddress owns token with ID: ${originChainTokenID}`, async () => {
        const tokenOwner = await OriginERC721MintableInstance.ownerOf(originChainTokenID);
        assert.strictEqual(tokenOwner, depositorAddress);
    });

    it("[sanity] test OriginERC721HandlerInstance.address' allowance", async () => {
        const allowanceHolder = await OriginERC721MintableInstance.getApproved(originChainTokenID);
        assert.strictEqual(allowanceHolder, OriginERC721HandlerInstance.address);
    });

    it('ERC721 deposit can be made', async () => {
        await BridgeInstance.deposit(
            destinationDomainID,
            originResourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        )
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationDomainID,
            originResourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationDomainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC721 can be deposited with correct owner and balances', async () => {
        await BridgeInstance.deposit(
            destinationDomainID,
            originResourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        const tokenOwner = await OriginERC721MintableInstance.ownerOf(originChainTokenID);
        assert.strictEqual(tokenOwner, OriginERC721HandlerInstance.address);

        const originChainDepositorBalance = await OriginERC721MintableInstance.balanceOf(depositorAddress);
        assert.strictEqual(originChainDepositorBalance.toNumber(), 0);

        const originChainHandlerBalance = await OriginERC721MintableInstance.balanceOf(OriginERC721HandlerInstance.address);
        assert.strictEqual(originChainHandlerBalance.toNumber(), 1);
    });

    it('Deposit event is fired with expected value', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationDomainID,
            originResourceID,
            depositData,
            feeData,
            { from: depositorAddress }
        );

        let expectedMetaData = Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes(genericBytes));

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {

            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === originResourceID.toLowerCase() &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.user === depositorAddress &&
                event.data === depositData.toLowerCase() &&
                event.handlerResponse === expectedMetaData
        });
    });

    it('Deposit destination domain can not be current bridge domain ', async () => {
        await TruffleAssert.reverts(BridgeInstance.deposit(originDomainID, '0x0', depositData, feeData, { from: depositorAddress }), "Can't deposit to current domain");
  });
});
