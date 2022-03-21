/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../../helpers");

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");

contract("BasicFeeHandler - [collectFee]", async (accounts) => {
    
    const relayerThreshold = 1;
    const domainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];

    const depositAmount = 10;
    const feeData = "0x0";

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;
    let BasicFeeHandlerInstance;

    let resourceID;
    let depositData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(domainID, [], relayerThreshold, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, depositAmount),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
        ]);
        
        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress);

        BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(BridgeInstance.address);
    });

    it("[sanity] Generic deposit can be made", async () => {
        await TruffleAssert.passes(BridgeInstance.deposit(
            domainID,
            resourceID,
            depositData,
            feeData,
            { from: depositerAddress }
        ));
    });

    it("deposit should revert if invalid fee amount supplied", async () => {
        await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
        // current fee is set to 0
        assert.equal(await BasicFeeHandlerInstance._fee.call(), 0);
        
        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                domainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("1.0")
                }
            ),
            "Incorrect fee supplied"
        )
    });

    it("deposit should pass if valid fee amount supplied", async () => {
        await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
        // current fee is set to 0
        assert.equal(await BasicFeeHandlerInstance._fee.call(), 0);
        // Change fee to 0.5 ether
        await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("0.5"));
        assert.equal(web3.utils.fromWei((await BasicFeeHandlerInstance._fee.call()), "ether"), "0.5");

        await TruffleAssert.passes(
            BridgeInstance.deposit(
                domainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("0.5")
                }
            )
        )
    });

    it("deposit should revert if fee handler not set and fee supplied", async () => {        
        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                domainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("1.0")
                }
            ),
            "no FeeHandler, msg.value != 0"
        )
    });

    it("deposit should pass if fee handler not set and fee not supplied", async () => {
        await TruffleAssert.passes(
            BridgeInstance.deposit(
                domainID,
                resourceID,
                depositData,
                feeData,
                { from: depositerAddress }
            )
        )
    });
});