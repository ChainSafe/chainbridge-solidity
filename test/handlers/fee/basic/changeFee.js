/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require('../../../helpers');

const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");
const FeeHandlerRouterContract = artifacts.require("FeeHandlerRouter");

contract("BasicFeeHandler - [changeFee]", async accounts => {
    const domainID = 1;
    const nonAdmin = accounts[1];

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: nonAdmin}), "sender doesn't have admin role");
    };

    let BridgeInstance;

    beforeEach(async () => {
        BridgeInstance = await Helpers.deployBridge(domainID, accounts[0]);
        FeeHandlerRouterInstance = await FeeHandlerRouterContract.new(BridgeInstance.address);
    });

    it("[sanity] contract should be deployed successfully", async () => {
        TruffleAssert.passes(
            await BasicFeeHandlerContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address));
    });

    it("should set fee", async () => {
        const BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address);
        const fee = Ethers.utils.parseEther("0.05");
        const tx = await BasicFeeHandlerInstance.changeFee(fee);
        TruffleAssert.eventEmitted(tx, "FeeChanged", (event) =>
            web3.utils.fromWei(event.newFee, "ether") === "0.05"
        );
        const newFee = await BasicFeeHandlerInstance._fee.call();
        assert.equal(web3.utils.fromWei(newFee, "ether"), "0.05");
    });

    it("should not set the same fee", async () => {
        const BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address);
        await TruffleAssert.reverts(BasicFeeHandlerInstance.changeFee(0), "Current fee is equal to new fee");
    });

    it("should require admin role to change fee", async () => {
        const BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address);
        await assertOnlyAdmin(BasicFeeHandlerInstance.changeFee, 1);
    });
});
