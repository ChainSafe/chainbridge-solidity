/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

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

    let RelayerInstance;
    let BridgeInstance;
    let OriginERC721MintableInstance;
    let OriginERC721HandlerInstance;
    let DestinationERC721MintableInstance;
    let DestinationERC721HandlerInstance;
    let depositData;

    let originResourceID;
    let originInitialResourceIDs;
    let originInitialContractAddresses;
    let originBurnableContractAddresses;

    let destinationResourceID;
    let destinationInitialResourceIDs;
    let destinationInitialContractAddresses;
    let destinationBurnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            ERC721MintableContract.new("token", "TOK", "").then(instance => OriginERC721MintableInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => DestinationERC721MintableInstance = instance),
            BridgeInstance = await BridgeContract.new(originChainID, [], 0)
        ]);

        originResourceID = Ethers.utils.hexZeroPad((OriginERC721MintableInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)
        originInitialResourceIDs = [originResourceID];
        originInitialContractAddresses = [OriginERC721MintableInstance.address];
        originBurnableContractAddresses =[];

        destinationResourceID = Ethers.utils.hexZeroPad((DestinationERC721MintableInstance.address + Ethers.utils.hexlify(destinationChainID).substr(2)), 32)
        destinationInitialResourceIDs = [destinationResourceID];
        destinationInitialContractAddresses = [DestinationERC721MintableInstance.address];
        destinationBurnableContractAddresses = [];

        await Promise.all([
            ERC721HandlerContract.new(BridgeInstance.address, originInitialResourceIDs, originInitialContractAddresses, originBurnableContractAddresses).then(instance => OriginERC721HandlerInstance = instance),
            ERC721HandlerContract.new(BridgeInstance.address, destinationInitialResourceIDs, destinationInitialContractAddresses, destinationBurnableContractAddresses).then(instance => DestinationERC721HandlerInstance = instance)
        ]);

        await OriginERC721MintableInstance.mint(depositerAddress, originChainTokenID, genericBytes);
        await OriginERC721MintableInstance.approve(OriginERC721HandlerInstance.address, originChainTokenID, { from: depositerAddress });

        depositData = '0x' +
            originResourceID.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(originChainTokenID), 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // len of next arg in bytes
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // len of next arg in bytes
            Ethers.utils.hexZeroPad(genericBytes, 32).substr(2);
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
            OriginERC721HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        )
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            OriginERC721HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositNonce);
    });

    it('ERC721 can be deposited with correct owner and balances', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            OriginERC721HandlerInstance.address,
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

    it('ERC721 deposit record is created with expected depositNonce and values', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            OriginERC721HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const depositRecord = await BridgeInstance._depositRecords.call(destinationChainID, expectedDepositNonce);
        assert.strictEqual(depositRecord, depositData.toLowerCase(), "Stored depositRecord does not match original depositData");
    });

    it('Deposit event is fired with expected value', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationChainID,
            OriginERC721HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationChainID.toNumber() === destinationChainID &&
                event.originChainHandlerAddress === OriginERC721HandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositNonce
        });
    });
});