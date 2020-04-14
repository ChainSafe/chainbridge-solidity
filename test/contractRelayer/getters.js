/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const RelayerContract = artifacts.require("Relayer");

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Relayer - [getters]', async accounts => {
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;

    let RelayerInstance;

    before(async () => {
        RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold)
    });

    it('isRelayer should return correct bool for addresses', async () => {
        for (const relayerAddress of initialRelayers) {
            const isRelayer = await RelayerInstance.isRelayer.call(relayerAddress);
            assert.isTrue(isRelayer);
        }

        const isRelayer = await RelayerInstance.isRelayer.call(accounts[4]);
        assert.isFalse(isRelayer);
    });

    it('getTotalRelayers should return correct number of relayers', async () => {
        const numRelayers = await RelayerInstance.getTotalRelayers.call();
        assert.equal(initialRelayers.length, numRelayers);
    });
});
