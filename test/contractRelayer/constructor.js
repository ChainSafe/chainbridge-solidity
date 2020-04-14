/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');

const RelayerContract = artifacts.require("Relayer");

contract('Relayer - [constructor]', async accounts => {
    const initialRelayers = accounts.slice(1, 4);
    const initialRelayerThreshold = 2;

    it('[sanity] contract should be deployed successfully', async () => {
        await TruffleAssert.passes(RelayerContract.new(initialRelayers, initialRelayerThreshold));
    });

    it('initialRelayers and relayerThreshold should be set correctly', async () => {
        const RelayerInstance = await RelayerContract.new(initialRelayers, initialRelayerThreshold);
        
        const setRelayerThreshold = await RelayerInstance._relayerThreshold.call();
        assert.equal(initialRelayerThreshold, setRelayerThreshold);

        for (const relayerAddress of initialRelayers) {
            const isRelayer = await RelayerInstance._relayers.call(relayerAddress);
            assert.isTrue(isRelayer);
        }
    });
});
