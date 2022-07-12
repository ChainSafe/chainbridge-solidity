/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const TruffleAssert = require("truffle-assertions");

 const Helpers = require("../../../helpers");

 const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");

 contract("BasicFeeHandler - [admin]", async accounts => {
    const domainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const currentFeeHandlerAdmin = accounts[0];

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: initialRelayers[1]}), "sender doesn't have admin role");
    };

    let BridgeInstance;
    let BasicFeeHandlerInstance;
    let ADMIN_ROLE;

    beforeEach(async () => {
        BridgeInstance = awaitBridgeInstance = await Helpers.deployBridge(domainID, accounts[0]);
        BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address);

        ADMIN_ROLE = await BasicFeeHandlerInstance.DEFAULT_ADMIN_ROLE();
    });

    it("should set fee property", async () => {
        const fee = 3;
        assert.equal(await BasicFeeHandlerInstance._fee.call(), "0");
        await BasicFeeHandlerInstance.changeFee(fee);
        assert.equal(await BasicFeeHandlerInstance._fee.call(), fee);
    });

    it("should require admin role to change fee property", async () => {
        const fee = 3;
        await assertOnlyAdmin(BasicFeeHandlerInstance.changeFee, fee);
    });

    it('FeeHandlerWithOracle admin should be changed to expectedFeeHandlerWithOracleAdmin', async () => {
        const expectedFeeHandlerWithOracleAdmin = accounts[1];

        // check current admin
        assert.isTrue(await BasicFeeHandlerInstance.hasRole(ADMIN_ROLE, currentFeeHandlerAdmin));

        await TruffleAssert.passes(BasicFeeHandlerInstance.renounceAdmin(expectedFeeHandlerWithOracleAdmin))
        assert.isTrue(await BasicFeeHandlerInstance.hasRole(ADMIN_ROLE, expectedFeeHandlerWithOracleAdmin));

        // check that former admin is no longer admin
        assert.isFalse(await BasicFeeHandlerInstance.hasRole(ADMIN_ROLE, currentFeeHandlerAdmin));
    });
});
