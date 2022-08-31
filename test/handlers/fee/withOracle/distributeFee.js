/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../../helpers");

const BridgeContract = artifacts.require("Bridge");
const FeeHandlerWithOracleContract = artifacts.require("FeeHandlerWithOracle");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const FeeHandlerRouterContract = artifacts.require("FeeHandlerRouter");

contract("FeeHandlerWithOracle - [distributeFee]", async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const oracle = new Ethers.Wallet.createRandom();
    const recipientAddress = accounts[2];
    const depositorAddress = accounts[1];

    const tokenAmount = feeAmount = Ethers.utils.parseEther("1");

    let BridgeInstance;
    let FeeHandlerWithOracleInstance;
    let resourceID;
    let depositData;
    let feeData;
    let oracleResponse;
    let FeeHandlerRouterInstance;

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: accounts[1]}), "sender doesn't have admin role");
    };

    beforeEach(async () => {
        BridgeInstance = await Helpers.deployBridge(originDomainID, accounts[0]);
        FeeHandlerRouterInstance = await FeeHandlerRouterContract.new(BridgeInstance.address);
        FeeHandlerWithOracleInstance = await FeeHandlerWithOracleContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address);
        await FeeHandlerWithOracleInstance.setFeeOracle(oracle.address);

        const gasUsed = 100000;
        const feePercent = 10000;
        await FeeHandlerWithOracleInstance.setFeeProperties(gasUsed, feePercent);

        ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address),
            ERC20MintableInstance.mint(depositorAddress, tokenAmount.add(feeAmount)),
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, tokenAmount, { from: depositorAddress }),
            ERC20MintableInstance.approve(FeeHandlerWithOracleInstance.address, tokenAmount, { from: depositorAddress }),
            BridgeInstance.adminChangeFeeHandler(FeeHandlerRouterInstance.address),
            FeeHandlerRouterInstance.adminSetResourceHandler(destinationDomainID, resourceID, FeeHandlerWithOracleInstance.address),
        ]);

        depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);
        oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            expiresAt: Math.floor(new Date().valueOf() / 1000) + 500,
            fromDomainID: originDomainID,
            toDomainID: destinationDomainID,
            resourceID
        };

        feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("should distribute fees", async () => {
        // check the balance is 0
        let b1Before = (await ERC20MintableInstance.balanceOf(accounts[3])).toString();
        let b2Before = (await ERC20MintableInstance.balanceOf(accounts[4])).toString();

        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositorAddress
                }
            )
        );
        const balance = await ERC20MintableInstance.balanceOf(FeeHandlerWithOracleInstance.address);
        assert.equal(web3.utils.fromWei(balance, "ether"), "1");

        let payout = Ethers.utils.parseEther("0.5");

        // Transfer the funds
        const tx = await FeeHandlerWithOracleInstance.transferFee(
                resourceID,
                [accounts[3], accounts[4]],
                [payout, payout]
            );
        TruffleAssert.eventEmitted(tx, 'FeeDistributed', (event) => {
            return event.tokenAddress === ERC20MintableInstance.address &&
            event.recipient === accounts[3] &&
            event.amount.toString() === payout.toString()
         });
         TruffleAssert.eventEmitted(tx, 'FeeDistributed', (event) => {
            return event.tokenAddress === ERC20MintableInstance.address &&
            event.recipient === accounts[4] &&
            event.amount.toString() === payout.toString()
         });
        b1 = await ERC20MintableInstance.balanceOf(accounts[3]);
        b2 = await ERC20MintableInstance.balanceOf(accounts[4]);
        assert.equal(b1.toString(), payout.add(b1Before).toString());
        assert.equal(b2.toString(), payout.add(b2Before).toString());
    });

    it("should not distribute fees with other resourceID", async () => {
        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositorAddress
                }
            )
        );
        const balance = await ERC20MintableInstance.balanceOf(FeeHandlerWithOracleInstance.address);
        assert.equal(web3.utils.fromWei(balance, "ether"), "1");

        let payout = Ethers.utils.parseEther("0.5");

        // Incorrect resourceID
        resourceID = Helpers.createResourceID(FeeHandlerWithOracleInstance.address, originDomainID);

        // Transfer the funds: fails
        await TruffleAssert.reverts(
            FeeHandlerWithOracleInstance.transferFee(
                resourceID,
                [accounts[3], accounts[4]],
                [payout, payout]
            )
        );
    });

    it("should require admin role to distribute fee", async () => {
        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositorAddress
                }
            )
        );
        const balance = await ERC20MintableInstance.balanceOf(FeeHandlerWithOracleInstance.address);
        assert.equal(web3.utils.fromWei(balance, "ether"), "1");

        let payout = Ethers.utils.parseEther("0.5");
        await assertOnlyAdmin(FeeHandlerWithOracleInstance.transferFee, resourceID, [accounts[3], accounts[4]], [payout, payout]);
    });

    it("should revert if addrs and amounts arrays have different length", async () => {
        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositorAddress
                }
            )
        );
        const balance = await ERC20MintableInstance.balanceOf(FeeHandlerWithOracleInstance.address);
        assert.equal(web3.utils.fromWei(balance, "ether"), "1");

        let payout = Ethers.utils.parseEther("0.5");
        await TruffleAssert.reverts(FeeHandlerWithOracleInstance.transferFee(resourceID, [accounts[3], accounts[4]], [payout, payout, payout]),
            "addrs[], amounts[]: diff length");
    });
});
