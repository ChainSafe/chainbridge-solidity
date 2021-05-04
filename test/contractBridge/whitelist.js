/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const BridgeContract = artifacts.require("Bridge");

contract('Bridge - [whitelist]', async accounts => {
    const chainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;

    let BridgeInstance;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(chainID, initialRelayers, initialRelayerThreshold, 0, 100);
    });

    // Testing whitelist methods

    it('should enable/disable whitelist and emit events', async () => {
        assert.isFalse(await BridgeInstance.isWhitelistEnabled());
        const enableTx = await BridgeInstance.enableWhitelist();
        TruffleAssert.eventEmitted(enableTx, 'WhitelistEnabled');
        assert.isTrue(await BridgeInstance.isWhitelistEnabled());
        const disableTx = await BridgeInstance.disableWhitelist();
        TruffleAssert.eventEmitted(disableTx, 'WhitelistDisabled');
        assert.isFalse(await BridgeInstance.isWhitelistEnabled());
    });

    it('should require admin role to enable/disable whitelist', async () => {
        await TruffleAssert.passes(BridgeInstance.enableWhitelist({from: accounts[0]}))
        await TruffleAssert.reverts(
            BridgeInstance.enableWhitelist({from: accounts[1]}),
            "Sender doesn't have Whitelist or Admin role"
        )
        await TruffleAssert.passes(BridgeInstance.disableWhitelist({from: accounts[0]}))
        await TruffleAssert.reverts(
            BridgeInstance.disableWhitelist({from: accounts[1]}),
            "Sender doesn't have Whitelist or Admin role"
        )
    });

    it('should revert if whitelist is already enabled/disabled', async () => {
        await TruffleAssert.reverts(
            BridgeInstance.disableWhitelist(),
            "Whitelist is already disabled"
        )
        await BridgeInstance.enableWhitelist();
        await TruffleAssert.reverts(
            BridgeInstance.enableWhitelist(),
            "Whitelist is already enabled"
        )
    });
});
