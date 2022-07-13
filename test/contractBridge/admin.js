/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const GenericHandlerContract = artifacts.require('GenericHandler');
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");

// This test does NOT include all getter methods, just
// getters that should work with only the constructor called
contract('Bridge - [admin]', async (accounts) => {
    const domainID = 1;
    const nonAdminAddress = accounts[1];

    const expectedBridgeAdmin = accounts[0];
    const someAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const topologyHash = "549f715f5b06809ada23145c2dc548db";

    const bytes32 = "0x0";
    let ADMIN_ROLE;

    let BridgeInstance;

    let withdrawData = '';

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: nonAdminAddress}), "sender doesn't have access to function");
    };

    beforeEach(async () => {
        BridgeInstance = await Helpers.deployBridge(domainID, expectedBridgeAdmin);
    });

    // Testing pauseable methods

    it('Bridge should not be paused after MPC address is set', async () => {
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
        assert.isFalse(await BridgeInstance.paused());
    });

    it('Bridge should be paused after being paused by admin', async () => {
        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);

        await TruffleAssert.passes(BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
    });

    it('Bridge should be unpaused after being paused by admin', async () => {
        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);

        await TruffleAssert.passes(BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
        await TruffleAssert.passes(BridgeInstance.adminUnpauseTransfers());
        assert.isFalse(await BridgeInstance.paused());
    });

    // Testing starKeygen, endKeygen and refreshKey methods

    it('Should successfully emit "StartKeygen" event if called by admin', async () => {
        const startKeygenTx = await BridgeInstance.startKeygen();

        TruffleAssert.eventEmitted(startKeygenTx, 'StartKeygen');
    });

    it('Should fail if "StartKeygen" is called by non admin', async () => {
        await assertOnlyAdmin(BridgeInstance.startKeygen);
    });

    it('Should fail if "StartKeygen" is called after MPC address is set', async () => {
        await BridgeInstance.endKeygen(Helpers.mpcAddress);

        await TruffleAssert.reverts(BridgeInstance.startKeygen(), "MPC address is already set");
    });

    it('Should successfully set MPC address and emit "EndKeygen" event if called by admin', async () => {
        const startKeygenTx = await BridgeInstance.endKeygen(Helpers.mpcAddress);

        assert.equal(await BridgeInstance._MPCAddress(), Helpers.mpcAddress);

        TruffleAssert.eventEmitted(startKeygenTx, 'EndKeygen');
    });

    it('Should fail if "endKeygen" is called by non admin', async () => {
        await assertOnlyAdmin(BridgeInstance.endKeygen, someAddress);
    });

    it('Should fail if null address is passed as MPC address', async () => {
        await TruffleAssert.reverts(BridgeInstance.endKeygen(nullAddress), "MPC address can't be null-address");
    });

    it('Should fail if admin tries to update MPC address', async () => {
        await BridgeInstance.endKeygen(Helpers.mpcAddress);

        await TruffleAssert.reverts(BridgeInstance.endKeygen(someAddress), "MPC address can't be updated");
    });

    it('Should successfully emit "KeyRefresh" event with expected hash value if called by admin', async () => {
        const startKeygenTx = await BridgeInstance.refreshKey(topologyHash);

        TruffleAssert.eventEmitted(startKeygenTx, 'KeyRefresh', (event) => {
            return event.hash = topologyHash;
        });
    });

    it('Should fail if "refreshKey" is called by non admin', async () => {
        await assertOnlyAdmin(BridgeInstance.refreshKey, topologyHash);
    });

    // Set Handler Address

    it('Should set a Resource ID for handler address', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        assert.equal(await BridgeInstance._resourceIDToHandlerAddress.call(resourceID), Ethers.constants.AddressZero);

        await TruffleAssert.passes(BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));
        assert.equal(await BridgeInstance._resourceIDToHandlerAddress.call(resourceID), ERC20HandlerInstance.address);
    });

    // Set resource ID

    it('Should set a ERC20 Resource ID and contract address', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await TruffleAssert.passes(BridgeInstance.adminSetResource(
            ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));
        assert.equal(await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID), ERC20MintableInstance.address);
        assert.equal(await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance.address), resourceID.toLowerCase());
    });

    it('Should require admin role to set a ERC20 Resource ID and contract address', async () => {
        await assertOnlyAdmin(BridgeInstance.adminSetResource, someAddress, bytes32, someAddress);
    });

    // Set Generic Resource

    it('Should set a Generic Resource ID and contract address', async () => {
        const CentrifugeAssetInstance = await CentrifugeAssetContract.new();
        const resourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, domainID);
        const GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address);

        await TruffleAssert.passes(BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, resourceID, CentrifugeAssetInstance.address, '0x00000000', 0, '0x00000000'));
        assert.equal(await GenericHandlerInstance._resourceIDToContractAddress.call(resourceID), CentrifugeAssetInstance.address);
        assert.equal(await GenericHandlerInstance._contractAddressToResourceID.call(CentrifugeAssetInstance.address), resourceID.toLowerCase());
    });

    it('Should require admin role to set a Generic Resource ID and contract address', async () => {
        await assertOnlyAdmin(BridgeInstance.adminSetGenericResource, someAddress, bytes32, someAddress, '0x00000000', 0, '0x00000000');
    });

    // Set burnable

    it('Should set ERC20MintableInstance.address as burnable', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await TruffleAssert.passes(BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));
        await TruffleAssert.passes(BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance.address));
        assert.isTrue(await ERC20HandlerInstance._burnList.call(ERC20MintableInstance.address));
    });

    it('Should require admin role to set ERC20MintableInstance.address as burnable', async () => {
        await assertOnlyAdmin(BridgeInstance.adminSetBurnable, someAddress, someAddress);
    });

    // Withdraw

    it('Should withdraw funds', async () => {
        const numTokens = 10;
        const tokenOwner = accounts[0];

        let ownerBalance;
        let handlerBalance;

        const ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        const resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await TruffleAssert.passes(BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));

        await ERC20MintableInstance.mint(tokenOwner, numTokens);
        ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
        assert.equal(ownerBalance, numTokens);

        await ERC20MintableInstance.transfer(ERC20HandlerInstance.address, numTokens);

        ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
        assert.equal(ownerBalance, 0);
        handlerBalance = await ERC20MintableInstance.balanceOf(ERC20HandlerInstance.address);
        assert.equal(handlerBalance, numTokens);

        withdrawData = Helpers.createERCWithdrawData(ERC20MintableInstance.address, tokenOwner, numTokens);

        await BridgeInstance.adminWithdraw(ERC20HandlerInstance.address, withdrawData);
        ownerBalance = await ERC20MintableInstance.balanceOf(tokenOwner);
        assert.equal(ownerBalance, numTokens);
    });

    it('Should require admin role to withdraw funds', async () => {
        await assertOnlyAdmin(BridgeInstance.adminWithdraw, someAddress, "0x0");
    });

    // Set nonce

    it('Should set nonce', async () => {
        const nonce = 3;
        await BridgeInstance.adminSetDepositNonce(domainID, nonce);
        const nonceAfterSet = await BridgeInstance._depositCounts.call(domainID);
        assert.equal(nonceAfterSet, nonce);
    });

    it('Should require admin role to set nonce', async () => {
        await assertOnlyAdmin(BridgeInstance.adminSetDepositNonce, 1, 3);
    });

    it('Should not allow for decrements of the nonce', async () => {
        const currentNonce = 3;
        await BridgeInstance.adminSetDepositNonce(domainID, currentNonce);
        const newNonce = 2;
        await TruffleAssert.reverts(BridgeInstance.adminSetDepositNonce(domainID, newNonce), "Does not allow decrements of the nonce");
    });

    // Change access control contract

    it('Should require admin role to change access control contract', async () => {
        await assertOnlyAdmin(BridgeInstance.adminChangeAccessControl, someAddress)
    })

});
