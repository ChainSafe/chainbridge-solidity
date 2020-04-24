/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Bridge - [admin]', async accounts => {
    const chainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const expectedBridgeAdmin = accounts[0];

    let RelayerInstance;
    let BridgeInstance;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold)
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, initialRelayerThreshold);
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
        assert.isTrue(await RelayerInstance.isRelayer(newRelayer));
    });

    // Testing ownership methods

    it('Bridge admin should be expectedBridgeAdmin', async () => {
        assert.equal(await BridgeInstance.owner(), expectedBridgeAdmin);
    });

    it('Bridge admin should be expectedBridgeAdmin', async () => {
        const expectedBridgeAdmin2 = accounts[1];
        TruffleAssert.passes(await BridgeInstance.transferOwnership(expectedBridgeAdmin2))
        assert.equal(await BridgeInstance.owner(), expectedBridgeAdmin2);
    });

    it('Bridge admin should be set to zero address', async () => {
        TruffleAssert.passes(await BridgeInstance.renounceOwnership())
        assert.equal(await BridgeInstance.owner(), zeroAddress);
    });
});
