/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Bridge - [ownable]', async accounts => {
    const chainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;

    const expectedBridgeAdmin = accounts[0];
    const expectedBridgeAdmin2 = accounts[1];

    let RelayerInstance;
    let BridgeInstance;

    before(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold)
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, initialRelayerThreshold);
    });

    it('Bridge admin should be expectedBridgeAdmin', async () => {
        assert.equal(await BridgeInstance.owner(), expectedBridgeAdmin);
    });

    it('Bridge admin should be expectedBridgeAdmin', async () => {
        TruffleAssert.passes(await BridgeInstance.transferOwnership(expectedBridgeAdmin2))
        assert.equal(await BridgeInstance.owner(), expectedBridgeAdmin2);
    });
});
