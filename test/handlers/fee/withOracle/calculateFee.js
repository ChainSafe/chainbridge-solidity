/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");
const EthCrypto = require("eth-crypto");

const Helpers = require("../../../helpers");

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const FeeHandlerWithOracleContract = artifacts.require("FeeHandlerWithOracle");
 
contract("FeeHandlerWithOracle - [calculateFee]", async accounts => {
    const relayerThreshold = 0;
    const domainID = 1;
    const oracle = EthCrypto.createIdentity();
    const sender = accounts[0];
    const recipientAddress = accounts[1];

    let BridgeInstance;
    let FeeHandlerWithOracleInstance;
    let resourceID;

    /*
        feeData structure:
            ber*10^18: uint256
            ter*10^18: uint256
            dstGasPrice: uint256
            timestamp: uint256
            fromDomainID: uint8 encoded as uint256
            toDomainID: uint8 encoded as uint256
            resourceID: bytes32
            sig: bytes(65 bytes)

        total in bytes:
        message:
            32 * 7  = 224
        message + sig:
            224 + 65 = 289

            amount: uint256
        total feeData length: 321
    */

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(domainID, [], relayerThreshold, 100).then(instance => BridgeInstance = instance);
        FeeHandlerWithOracleInstance = await FeeHandlerWithOracleContract.new(BridgeInstance.address);
        await FeeHandlerWithOracleInstance.setFeeOracle(oracle.address);

        const gasUsed = 100000;
        const feePercent = 500;
        const maxOracleTime = 500;
        await FeeHandlerWithOracleInstance.setFeeProperties(gasUsed, feePercent, maxOracleTime);

        ERC20MintableInstance = await ERC20MintableContract.new("token", "TOK");
        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address);
    });

    it("should calculate amount of fee and return token address", async () => {
        const tokenAmount = 100;      
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  

        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        const res = await FeeHandlerWithOracleInstance.calculateFee.call(sender, domainID, domainID, resourceID, depositData, feeData);
        assert.equal(Ethers.utils.formatEther(res.fee.toString()), "0.00491802");
        assert.equal(res.tokenAddress, ERC20MintableInstance.address);
    });

    it("should return percent fee", async () => {
        const tokenAmount = Ethers.utils.parseEther("1");
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  
        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        const res = await FeeHandlerWithOracleInstance.calculateFee.call(sender, domainID, domainID, resourceID, depositData, feeData);
        assert.equal(web3.utils.fromWei(res.fee, "ether"), "0.05");
        assert.equal(res.tokenAddress, ERC20MintableInstance.address);
    });

    it("should return fee to cover tx cost if percent fee does not cover tx cost", async () => {
        const tokenAmount = 100;      
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  

        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.0005"),
            ter: Ethers.utils.parseEther("1.5"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        const res = await FeeHandlerWithOracleInstance.calculateFee.call(sender, domainID, domainID, resourceID, depositData, feeData);
        assert.equal(Ethers.utils.formatEther(res.fee.toString()), "0.0045");
        assert.equal(res.tokenAddress, ERC20MintableInstance.address);
    });

    it("should not calculate fee if fee data is misformed", async () => {
        const tokenAmount = 100;      
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  

        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.0005"),
            ter: Ethers.utils.parseEther("1.5"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount) + "11";
        await TruffleAssert.reverts(FeeHandlerWithOracleInstance.calculateFee(sender, domainID, domainID, resourceID, depositData, feeData), "Incorrect feeData length");
    });

    it("should not calculate fee if deposit data differ from fee data", async () => {
        const otherDomainId = 2;
        const tokenAmount = 100;      
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  

        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.0005"),
            ter: Ethers.utils.parseEther("1.5"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        await TruffleAssert.reverts(FeeHandlerWithOracleInstance.calculateFee(sender, domainID, otherDomainId, resourceID, depositData, feeData), "Incorrect deposit params");
    });
    
    it("should not calculate fee if oracle signature is incorrect", async () => {
        const tokenAmount = 100;      
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  

        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.0005"),
            ter: Ethers.utils.parseEther("1.5"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };

        const oracle2 = EthCrypto.createIdentity();

        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle2.privateKey, tokenAmount);
        await TruffleAssert.reverts(FeeHandlerWithOracleInstance.calculateFee(sender, domainID, domainID, resourceID, depositData, feeData), "Invalid signature");
    });

    it("should not calculate fee if oracle data are outdated", async () => {
        const gasUsed = 100000;
        const feePercent = 500;
        const maxOracleTime = 5;
        await FeeHandlerWithOracleInstance.setFeeProperties(gasUsed, feePercent, maxOracleTime);

        const tokenAmount = Ethers.utils.parseEther("1");
        const depositData = Helpers.createERCDepositData(tokenAmount, 20, recipientAddress);  
        const oracleResponse = {
            ber: Ethers.utils.parseEther("0.000533"),
            ter: Ethers.utils.parseEther("1.63934"),
            dstGasPrice: Ethers.utils.parseUnits("30000000000", "wei"),
            timestamp: Math.floor(new Date().valueOf() / 1000),
            fromDomainID: domainID,
            toDomainID: domainID,
            resourceID
        };
        const feeData = Helpers.createOracleFeeData(oracleResponse, oracle.privateKey, tokenAmount);
        await Helpers.advanceTime(10);
        await TruffleAssert.reverts(FeeHandlerWithOracleInstance.calculateFee(sender, domainID, domainID, resourceID, depositData, feeData), "Obsolete oracle data");
    });
 });
 