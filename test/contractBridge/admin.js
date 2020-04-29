/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Bridge - [admin]', async accounts => {
    const chainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const expectedBridgeAdmin = accounts[0];
    let ADMIN_ROLE;

    let RelayerInstance;
    let BridgeInstance;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(chainID, initialRelayers, initialRelayerThreshold, 0);
        ADMIN_ROLE = await BridgeInstance.DEFAULT_ADMIN_ROLE()
    });

    // Testing pausable methods

    it('Bridge should not be paused', async () => {
        assert.isFalse(await BridgeInstance.paused());
    });

    it('Bridge should be paused', async () => {
        TruffleAssert.passes(await BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
    });

    it('Bridge should be unpaused after being paused', async () => {
        TruffleAssert.passes(await BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
        TruffleAssert.passes(await BridgeInstance.adminUnpauseTransfers());
        assert.isFalse(await BridgeInstance.paused());
    });

    // Testing relayer methods

    it('_relayerThreshold should be initialRelayerThreshold', async () => {
        assert.equal(await BridgeInstance._relayerThreshold.call(), initialRelayerThreshold);
    });

    it('_relayerThreshold should be initialRelayerThreshold', async () => {
        const newRelayerThreshold = 1;
        TruffleAssert.passes(await BridgeInstance.adminChangeRelayerThreshold(newRelayerThreshold));
        assert.equal(await BridgeInstance._relayerThreshold.call(), newRelayerThreshold);
    });

    it('newRelayer should be added as a relayer', async () => {
        const newRelayer = accounts[1];
        TruffleAssert.passes(await BridgeInstance.adminAddRelayer(newRelayer));
        assert.isTrue(await BridgeInstance.isRelayer(newRelayer));
    });

    it('newRelayer should be removed as a relayer after being added', async () => {
        const newRelayer = accounts[1];
        TruffleAssert.passes(await BridgeInstance.adminAddRelayer(newRelayer));
        assert.isTrue(await BridgeInstance.isRelayer(newRelayer))
        TruffleAssert.passes(await BridgeInstance.adminRemoveRelayer(newRelayer));
        assert.isFalse(await BridgeInstance.isRelayer(newRelayer));
    });

    // Testing ownership methods

    it('Bridge admin should be expectedBridgeAdmin', async () => {
        assert.isTrue(await BridgeInstance.hasRole(ADMIN_ROLE, expectedBridgeAdmin));
    });

    it('Bridge admin should be changed to expectedBridgeAdmin', async () => {
        const expectedBridgeAdmin2 = accounts[1];
        TruffleAssert.passes(await BridgeInstance.renounceAdmin(expectedBridgeAdmin2))
        assert.isTrue(await BridgeInstance.hasRole(ADMIN_ROLE, expectedBridgeAdmin2));
    });

    // Set resource ID

    it('Should set a ERC20 Resource ID and contract address', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        const resourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, [], [], []);

        TruffleAssert.passes(await BridgeInstance.adminSetResource(
            ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address));
        assert.equal(await ERC20HandlerInstance._resourceIDToTokenContractAddress.call(resourceID), ERC20MintableInstance.address);
        assert.equal(await ERC20HandlerInstance._tokenContractAddressToResourceID.call(ERC20MintableInstance.address), resourceID.toLowerCase());
    });

    // Set burnable

    it('Should set ERC20MintableInstance.address as burnable', async () => {
        const ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        const resourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        const ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, [resourceID], [ERC20MintableInstance.address], []);

        TruffleAssert.passes(await BridgeInstance.adminSetBurnable(ERC20HandlerInstance.address, ERC20MintableInstance.address));
        assert.isTrue(await ERC20HandlerInstance._burnList.call(ERC20MintableInstance.address));
    });


    it('Should set fee', async () => {
        assert.equal(await BridgeInstance._fee.call(), 0);

        const fee = Ethers.utils.parseEther("0.05");
        await BridgeInstance.adminChangeFee(fee);
        const newFee = await BridgeInstance._fee.call()
        assert.equal(web3.utils.fromWei(newFee, "ether"), "0.05")
    })
});
