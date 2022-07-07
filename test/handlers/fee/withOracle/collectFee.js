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
const FeeHandlerWithOracleContract = artifacts.require("FeeHandlerWithOracle");
const FeeHandlerRouterContract = artifacts.require("FeeHandlerRouter");

contract("FeeHandlerWithOracle - [collectFee]", async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const oracle = new Ethers.Wallet.createRandom();
    const recipientAddress = accounts[2];
    const tokenAmount = Ethers.utils.parseEther("1");
    const feeAmount =Ethers.utils.parseEther("0.05");
    const depositerAddress = accounts[1];

    let BridgeInstance;
    let FeeHandlerWithOracleInstance;
    let resourceID;
    let FeeHandlerRouterInstance;


    /*
        feeData structure:
            ber*10^18:      uint256
            ter*10^18:      uint256
            dstGasPrice:    uint256
            expiresAt:      uint256
            fromDomainID:   uint8 encoded as uint256
            toDomainID:     uint8 encoded as uint256
            resourceID:     bytes32
            sig:            bytes(65 bytes)

        total in bytes:
        message:
            32 * 7  = 224
        message + sig:
            224 + 65 = 289

            amount: uint256
        total feeData length: 321
    */

    beforeEach(async () => {
        BridgeInstance = await Helpers.deployBridge(originDomainID, accounts[0]);
        FeeHandlerRouterInstance = await FeeHandlerRouterContract.new(BridgeInstance.address);
        FeeHandlerWithOracleInstance = await FeeHandlerWithOracleContract.new(BridgeInstance.address, FeeHandlerRouterInstance.address);
        await FeeHandlerWithOracleInstance.setFeeOracle(oracle.address);

        const gasUsed = 100000;
        const feePercent = 500;
        await FeeHandlerWithOracleInstance.setFeeProperties(gasUsed, feePercent);

        ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, tokenAmount + feeAmount),
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, tokenAmount, { from: depositerAddress }),
            ERC20MintableInstance.approve(FeeHandlerWithOracleInstance.address, feeAmount, { from: depositerAddress }),
            BridgeInstance.adminChangeFeeHandler(FeeHandlerRouterInstance.address),
            FeeHandlerRouterInstance.adminSetResourceHandler(destinationDomainID, resourceID, FeeHandlerWithOracleInstance.address),
        ]);


        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("should collect fee in tokens", async () => {
        const fee = Ethers.utils.parseEther("0.05");
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);
        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            expiresAt: Math.floor(new Date().valueOf() / 1000) + 500,
            fromDomainID: originDomainID,
            toDomainID: destinationDomainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);

        const balanceBefore = (await ERC20MintableInstance.balanceOf(FeeHandlerWithOracleInstance.address)).toString();

        const depositTx = await BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress
                }
            );
        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === resourceID.toLowerCase();
        });
        const internalTx = await TruffleAssert.createTransactionResult(FeeHandlerWithOracleInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'FeeCollected', event => {
            return event.sender === depositerAddress &&
                event.fromDomainID.toNumber() === originDomainID &&
                event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === resourceID.toLowerCase() &&
                event.fee.toString() === fee.toString() &&
                event.tokenAddress === ERC20MintableInstance.address;
        });
        const balanceAfter = (await ERC20MintableInstance.balanceOf(FeeHandlerWithOracleInstance.address)).toString();
        assert.equal(balanceAfter, fee.add(balanceBefore).toString());
    });

    it("deposit should revert if msg.value != 0", async () => {
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);
        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            expiresAt: Math.floor(new Date().valueOf() / 1000) + 500,
            fromDomainID: originDomainID,
            toDomainID: destinationDomainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("0.5").toString(),
                }
            ),
            "msg.value != 0"
        );
    });

    it("deposit should revert if fee collection fails", async () => {
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);
        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            expiresAt: Math.floor(new Date().valueOf() / 1000) + 500,
            fromDomainID: originDomainID,
            toDomainID: originDomainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        await ERC20MintableInstance.approve(FeeHandlerWithOracleInstance.address, 0, { from: depositerAddress });
        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("0.5").toString(),
                }
            )
        );
    });

    it("deposit should revert if called not by bridge", async () => {
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);
        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            expiresAt: Math.floor(new Date().valueOf() / 1000) + 500,
            fromDomainID: originDomainID,
            toDomainID: destinationDomainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        await ERC20MintableInstance.approve(FeeHandlerWithOracleInstance.address, 0, { from: depositerAddress });
        await TruffleAssert.reverts(
            FeeHandlerWithOracleInstance.collectFee(
                depositerAddress,
                originDomainID,
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("0.5").toString(),
                }
            ),
            "sender must be fee router contract"
        );
    });
});
