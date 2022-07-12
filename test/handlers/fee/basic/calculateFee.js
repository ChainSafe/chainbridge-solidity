/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../../helpers");

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");
const FeeHandlerRouterContract = artifacts.require("FeeHandlerRouter");

contract("BasicFeeHandler - [calculateFee]", async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const relayer = accounts[0];
    const recipientAddress = accounts[1];
    const feeData = "0x0";

    let BridgeInstance;
    let BasicFeeHandlerInstance;
    let resourceID;
    let depositData;
    let initialResourceIDs;
    let initialContractAddresses;
    let ERC20MintableInstance;
    let FeeHandlerRouterInstance;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(destinationDomainID, accounts[0]),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
        ]);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        FeeHandlerRouterInstance = await FeeHandlerRouterContract.new(BridgeInstance.address);
        BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(FeeHandlerRouterInstance.address);

        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];

        burnableContractAddresses = [];

        depositData = Helpers.createERCDepositData(100, 20, recipientAddress);

        await Promise.all([
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address),
            BridgeInstance.adminChangeFeeHandler(FeeHandlerRouterInstance.address),
            FeeHandlerRouterInstance.adminSetResourceHandler(destinationDomainID, resourceID, BasicFeeHandlerInstance.address),
        ]);
    });

    it("should return amount of fee", async () => {
        // current fee is set to 0
        let res = await FeeHandlerRouterInstance.calculateFee.call(
            relayer,
            originDomainID,
            destinationDomainID,
            resourceID,
            depositData,
            feeData
        );

        assert.equal(web3.utils.fromWei(res[0], "ether"), "0");
        // Change fee to 0.5 ether
        await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("0.5"));
        res = await FeeHandlerRouterInstance.calculateFee.call(
            relayer,
            originDomainID,
            destinationDomainID,
            resourceID,
            depositData,
            feeData
        );
        assert.equal(web3.utils.fromWei(res[0], "ether"), "0.5");
    });
});
