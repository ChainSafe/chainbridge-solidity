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

contract("BasicFeeHandler - [distributeFee]", async (accounts) => {
    
    const relayerThreshold = 1;
    const domainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];

    const depositAmount = 10;
    const feeData = "0x0";

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: accounts[1]}), "sender doesn't have admin role");
    };

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
 
     it("should distribute fees", async () => {
         await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
         await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("1"));
         assert.equal(web3.utils.fromWei((await BasicFeeHandlerInstance._fee.call()), "ether"), "1");
 
         // check the balance is 0
         assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "0");
         await BridgeInstance.deposit(domainID, resourceID, depositData, feeData, {from: depositerAddress, value: Ethers.utils.parseEther("1")})
         assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "0");
         assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BasicFeeHandlerInstance.address)), "ether"), "1");
 
         let b1Before = await web3.eth.getBalance(accounts[1]);
         let b2Before = await web3.eth.getBalance(accounts[2]);
 
         let payout = Ethers.utils.parseEther("0.5")
         // Transfer the funds
         const tx = await BasicFeeHandlerInstance.transferFee(
                 [accounts[1], accounts[2]], 
                 [payout, payout]
             );
         TruffleAssert.eventEmitted(tx, 'FeeDistributed', (event) => {
            return event.tokenAddress === '0x0000000000000000000000000000000000000000' &&
            event.recipient === accounts[1] &&
            event.amount.toString() === payout.toString()
         });
         TruffleAssert.eventEmitted(tx, 'FeeDistributed', (event) => {
            return event.tokenAddress === '0x0000000000000000000000000000000000000000' &&
            event.recipient === accounts[2] &&
            event.amount.toString() === payout.toString()
         });
         b1 = await web3.eth.getBalance(accounts[1]);
         b2 = await web3.eth.getBalance(accounts[2]);
         assert.equal(b1, Ethers.BigNumber.from(b1Before).add(payout));
         assert.equal(b2, Ethers.BigNumber.from(b2Before).add(payout));
     });

     it("should require admin role to distribute fee", async () => {
        await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
        await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("1"));

        await BridgeInstance.deposit(domainID, resourceID, depositData, feeData, {from: depositerAddress, value: Ethers.utils.parseEther("1")});

        assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BasicFeeHandlerInstance.address)), "ether"), "1");

        let payout = Ethers.utils.parseEther("0.5");
        await assertOnlyAdmin(BasicFeeHandlerInstance.transferFee, [accounts[3], accounts[4]], [payout, payout]);
     });

     it("should revert if addrs and amounts arrays have different length", async () => {
        await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
        await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("1"));

        await BridgeInstance.deposit(domainID, resourceID, depositData, feeData, {from: depositerAddress, value: Ethers.utils.parseEther("1")});

        assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BasicFeeHandlerInstance.address)), "ether"), "1");

        let payout = Ethers.utils.parseEther("0.5");
        await TruffleAssert.reverts(BasicFeeHandlerInstance.transferFee([accounts[3], accounts[4]], [payout, payout, payout]),
            "addrs[], amounts[]: diff length");
     });
 });