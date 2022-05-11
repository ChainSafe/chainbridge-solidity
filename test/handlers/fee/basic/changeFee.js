/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const BridgeContract = artifacts.require("Bridge");
const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");

contract("BasicFeeHandler - [changeFee]", async accounts => {
    const relayerThreshold = 0;
    const domainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const relayer = accounts[0];

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: initialRelayers[1]}), "sender doesn't have admin role");
    };

    let BridgeInstance;

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(domainID, [], relayerThreshold, 100).then(instance => BridgeInstance = instance);
    });

    it("[sanity] contract should be deployed successfully", async () => {
        TruffleAssert.passes(
            await BasicFeeHandlerContract.new(BridgeInstance.address));
    });

    it("should set fee", async () => {
        const BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address);
        const fee = Ethers.utils.parseEther("0.05");
        const tx = await BasicFeeHandlerInstance.changeFee(fee);
        TruffleAssert.eventEmitted(tx, "FeeChanged", (event) => 
            web3.utils.fromWei(event.newFee, "ether") === "0.05"
        );
        const newFee = await BasicFeeHandlerInstance._fee.call();
        assert.equal(web3.utils.fromWei(newFee, "ether"), "0.05");
    });

    it("should not set the same fee", async () => {
        const BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address);
        await TruffleAssert.reverts(BasicFeeHandlerInstance.changeFee(0), "Current fee is equal to new fee");
    });

    it("should require admin role to change fee", async () => {
        const BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address);
        await assertOnlyAdmin(BasicFeeHandlerInstance.changeFee, 1);
    });
});
