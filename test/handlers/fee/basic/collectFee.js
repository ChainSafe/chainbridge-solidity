/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../../helpers");

const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");
const FeeHandlerRouterContract = artifacts.require("FeeHandlerRouter");

contract("BasicFeeHandler - [collectFee]", async (accounts) => {

    const originDomainID = 1;
    const destinationDomainID = 2;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];

    const depositAmount = 10;
    const feeData = "0x0";
    const tokenID = 1;


    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;
    let ERC721HandlerInstance;
    let ERC721MintableInstance;
    let ERC20BasicFeeHandlerInstance;
    let ERC721BasicFeeHandlerInstance;
    let FeeHandlerRouterInstance;

    let erc20ResourceID;
    let erc721ResourceID;
    let erc20depositData;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(originDomainID, accounts[0]),
            ERC20MintableInstance = ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
            ERC721MintableInstance = ERC721MintableContract.new("ERC721Token", "ERC721TOK", "").then(instance => ERC721MintableInstance = instance),
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);
        erc721ResourceID = Helpers.createResourceID(ERC721MintableInstance.address, originDomainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address);
        FeeHandlerRouterInstance = await FeeHandlerRouterContract.new(BridgeInstance.address);
        ERC20BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(FeeHandlerRouterInstance.address);
        ERC721BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(FeeHandlerRouterInstance.address);

        await Promise.all([
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, erc721ResourceID, ERC721MintableInstance.address),
            ERC20MintableInstance.mint(depositerAddress, depositAmount),
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress }),
            ERC721MintableInstance.mint(depositerAddress, tokenID, ""),
            ERC721MintableInstance.approve(ERC721HandlerInstance.address, tokenID, { from: depositerAddress }),
            BridgeInstance.adminChangeFeeHandler(FeeHandlerRouterInstance.address),
            FeeHandlerRouterInstance.adminSetResourceHandler(destinationDomainID, erc20ResourceID, ERC20BasicFeeHandlerInstance.address),
            FeeHandlerRouterInstance.adminSetResourceHandler(destinationDomainID, erc721ResourceID, ERC721BasicFeeHandlerInstance.address),
        ]);

        erc20depositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress);
        erc721depositData = Helpers.createERCDepositData(tokenID, 20, recipientAddress);


        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("[sanity] Generic deposit can be made", async () => {
        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationDomainID,
            erc20ResourceID,
            erc20depositData,
            feeData,
            { from: depositerAddress }
        ));
    });

    it("deposit should revert if invalid fee amount supplied", async () => {
        // current fee is set to 0
        assert.equal(await ERC20BasicFeeHandlerInstance._fee.call(), 0);

        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationDomainID,
                erc20ResourceID,
                erc20depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: Ethers.utils.parseEther("1.0")
                }
            ),
            "Incorrect fee supplied"
        )
    });

    it("deposit should pass if valid fee amount supplied for ERC20 deposit", async () => {
        const fee = Ethers.utils.parseEther("0.5");
        // current fee is set to 0
        assert.equal(await ERC20BasicFeeHandlerInstance._fee.call(), 0);
        // Change fee to 0.5 ether
        await ERC20BasicFeeHandlerInstance.changeFee(fee);
        assert.equal(web3.utils.fromWei((await ERC20BasicFeeHandlerInstance._fee.call()), "ether"), "0.5");

        const balanceBefore = await web3.eth.getBalance(ERC20BasicFeeHandlerInstance.address);

        const depositTx = await BridgeInstance.deposit(
                destinationDomainID,
                erc20ResourceID,
                erc20depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: fee
                }
            );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === erc20ResourceID.toLowerCase();
        });
        const internalTx = await TruffleAssert.createTransactionResult(ERC20BasicFeeHandlerInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'FeeCollected', event => {
            return event.sender === depositerAddress &&
                event.fromDomainID.toNumber() === originDomainID &&
                event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === erc20ResourceID.toLowerCase() &&
                event.fee.toString() === fee.toString() &&
                event.tokenAddress === "0x0000000000000000000000000000000000000000";
        });
        const balanceAfter = await web3.eth.getBalance(ERC20BasicFeeHandlerInstance.address);
        assert.equal(balanceAfter, fee.add(balanceBefore));
    });

    it("deposit should pass if valid fee amount supplied for ERC721 deposit", async () => {
        const fee = Ethers.utils.parseEther("0.4");
        // current fee is set to 0
        assert.equal(await ERC721BasicFeeHandlerInstance._fee.call(), 0);
        // Change fee to 0.4 ether
        await ERC721BasicFeeHandlerInstance.changeFee(fee);
        assert.equal(web3.utils.fromWei((await ERC721BasicFeeHandlerInstance._fee.call()), "ether"), "0.4");

        const balanceBefore = await web3.eth.getBalance(ERC721BasicFeeHandlerInstance.address);

        const depositTx = await BridgeInstance.deposit(
                destinationDomainID,
                erc721ResourceID,
                erc721depositData,
                feeData,
                {
                    from: depositerAddress,
                    value: fee
                }
            );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === erc721ResourceID.toLowerCase();
        });
        const internalTx = await TruffleAssert.createTransactionResult(ERC721BasicFeeHandlerInstance, depositTx.tx);
        TruffleAssert.eventEmitted(internalTx, 'FeeCollected', event => {
            return event.sender === depositerAddress &&
                event.fromDomainID.toNumber() === originDomainID &&
                event.destinationDomainID.toNumber() === destinationDomainID &&
                event.resourceID === erc721ResourceID.toLowerCase() &&
                event.fee.toString() === fee.toString() &&
                event.tokenAddress === "0x0000000000000000000000000000000000000000";
        });
        const balanceAfter = await web3.eth.getBalance(ERC721BasicFeeHandlerInstance.address);
        assert.equal(balanceAfter, fee.add(balanceBefore));
    });

    it("deposit should revert if fee handler not set and fee supplied", async () => {
        await BridgeInstance.adminChangeFeeHandler("0x0000000000000000000000000000000000000000");

        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationDomainID,
                erc20ResourceID,
                erc20depositData,
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
                destinationDomainID,
                erc20ResourceID,
                erc20depositData,
                feeData,
                { from: depositerAddress }
            )
        )
    });

    it("deposit should revert if not called by router on BasicFeeHandler contract", async () => {
      const fee = Ethers.utils.parseEther("0.5");
      await BridgeInstance.adminChangeFeeHandler(ERC20BasicFeeHandlerInstance.address);
      // current fee is set to 0
      assert.equal(await ERC20BasicFeeHandlerInstance._fee.call(), 0);
      // Change fee to 0.5 ether
      await ERC20BasicFeeHandlerInstance.changeFee(fee);
      assert.equal(web3.utils.fromWei((await ERC20BasicFeeHandlerInstance._fee.call()), "ether"), "0.5");

      const balanceBefore = await web3.eth.getBalance(ERC20BasicFeeHandlerInstance.address);

      await TruffleAssert.reverts(
          ERC20BasicFeeHandlerInstance.collectFee(
              depositerAddress,
              originDomainID,
              destinationDomainID,
              erc20ResourceID,
              erc20depositData,
              feeData,
              {
                  from: depositerAddress,
                  value: Ethers.utils.parseEther("0.5").toString(),
              }
            ),
            "sender must be fee router contract"
        );

      const balanceAfter = await web3.eth.getBalance(ERC20BasicFeeHandlerInstance.address);
      assert.equal(balanceAfter, balanceBefore);
    });

    it("deposit should revert if not called by bridge on FeeHandlerRouter contract", async () => {
      const fee = Ethers.utils.parseEther("0.5");
      await BridgeInstance.adminChangeFeeHandler(ERC20BasicFeeHandlerInstance.address);
      // current fee is set to 0
      assert.equal(await ERC20BasicFeeHandlerInstance._fee.call(), 0);
      // Change fee to 0.5 ether
      await ERC20BasicFeeHandlerInstance.changeFee(fee);
      assert.equal(web3.utils.fromWei((await ERC20BasicFeeHandlerInstance._fee.call()), "ether"), "0.5");

      const balanceBefore = await web3.eth.getBalance(ERC20BasicFeeHandlerInstance.address);

      await TruffleAssert.reverts(
          FeeHandlerRouterInstance.collectFee(
              depositerAddress,
              originDomainID,
              destinationDomainID,
              erc20ResourceID,
              erc20depositData,
              feeData,
              {
                  from: depositerAddress,
                  value: Ethers.utils.parseEther("0.5").toString(),
              }
            ),
            "sender must be bridge contract"
        );

      const balanceAfter = await web3.eth.getBalance(ERC20BasicFeeHandlerInstance.address);
      assert.equal(balanceAfter, balanceBefore);
    });
});
