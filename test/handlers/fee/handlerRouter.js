/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");

const Helpers = require("../../helpers");

const FeeHandlerWithOracleContract = artifacts.require("FeeHandlerWithOracle");
const FeeHandlerRouterContract = artifacts.require("FeeHandlerRouter");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");


contract("FeeHandlerRouter", async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const nonAdmin = accounts[1];

    const assertOnlyAdmin = (method, ...params) => {
      return TruffleAssert.reverts(method(...params, {from: nonAdmin}), "sender doesn't have admin role");
  };

    let BridgeInstance;
    let FeeHandlerWithOracleInstance;
    let FeeHandlerRouterInstance;
    let ERC20MintableInstance;
    let resourceID;

    beforeEach(async () => {
        await Promise.all([
          BridgeInstance = await Helpers.deployBridge(destinationDomainID, accounts[0]),
          ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);

        FeeHandlerRouterInstance = await FeeHandlerRouterContract.new(BridgeInstance.address);
        FeeHandlerWithOracleInstance = await FeeHandlerWithOracleContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address);

        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);
    });

     it("should successfully set handler to resourceID", async () => {
        const feeHandlerAddress = accounts[1];
        assert.equal(await FeeHandlerRouterInstance._domainResourceIDToFeeHandlerAddress.call(destinationDomainID, resourceID), "0x0000000000000000000000000000000000000000");
        await FeeHandlerRouterInstance.adminSetResourceHandler(destinationDomainID, resourceID, feeHandlerAddress);
        const newFeeHandler = await FeeHandlerRouterInstance._domainResourceIDToFeeHandlerAddress(destinationDomainID, resourceID);
        assert.equal(newFeeHandler, feeHandlerAddress);
     });

    it("should require admin role to set handler for resourceID", async () => {
        const feeHandlerAddress = accounts[1];
        await assertOnlyAdmin(FeeHandlerRouterInstance.adminSetResourceHandler, destinationDomainID, resourceID, feeHandlerAddress);
    });
});
