/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');

const BridgeContract = artifacts.require("Bridge");

contract('Bridge - [constructor]', async accounts => {
    const chainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;

    const expectedBridgeAdmin = accounts[0];
    const someAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
    const bytes32 = "0x0";
    let ADMIN_ROLE;
    
    let BridgeInstance;

    const BN = (num) => {
        return web3.utils.toBN(num);
    };

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(chainID, initialRelayers, initialRelayerThreshold, 0, 100);
        ADMIN_ROLE = await BridgeInstance.DEFAULT_ADMIN_ROLE()
    });

    it('Bridge should not allow to set initialRelayerThreshold above 255', async () => {
        return TruffleAssert.reverts(BridgeContract.new(chainID, initialRelayers, 256, 0, 100), "value does not fit in 8 bits");
    });

    it('Bridge should not allow to set fee above 2**128 - 1', async () => {
        return TruffleAssert.reverts(BridgeContract.new(
            chainID, initialRelayers, initialRelayerThreshold, BN(2).pow(BN(128)), 100), "value does not fit in 128 bits");
    });

    it('Bridge should not allow to set expiry above 2**40 - 1', async () => {
        return TruffleAssert.reverts(BridgeContract.new(chainID, initialRelayers, initialRelayerThreshold, 0, BN(2).pow(BN(40))), "value does not fit in 40 bits");
    });
});
