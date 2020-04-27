/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('Bridge - [deposit - Generic]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const expectedDepositNonce = 1;
    const blankFunctionSig = '0x00000000';
    const relayer = accounts[0];

    let BridgeInstance;
    let GenericHandlerInstance;
    let depositData;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialExecuteFunctionSignatures;

    beforeEach(async () => {
        await Promise.all([
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            BridgeInstance = BridgeContract.new(originChainID, [relayer], 0, 0).then(instance => BridgeInstance = instance)
        ]);

        initialResourceIDs = [Ethers.utils.hexZeroPad((CentrifugeAssetInstance.address + Ethers.utils.hexlify(originChainID).substr(2)), 32)];
        initialContractAddresses = [CentrifugeAssetInstance.address];
        initialDepositFunctionSignatures = [blankFunctionSig];
        initialExecuteFunctionSignatures = [blankFunctionSig];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address,
            initialResourceIDs,
            initialContractAddresses,
            initialDepositFunctionSignatures,
            initialExecuteFunctionSignatures);

        depositData = '0x' +
            initialResourceIDs[0].substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(4), 32).substr(2) // len(metaData)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(0xdeadbeef), 4).substr(2) // metaData
    });

    it('[sanity] Generic deposit can be made', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            destinationChainID,
            GenericHandlerInstance.address,
            depositData
        ));
    });

    it('deposit reverts if invalid amount supplied', async () => {
        // current fee is set to 0
        assert.equals((await BridgeInstance._fee.call()).toNumber(), 0)
        
        TruffleAssert.fails(
            await BridgeInstance.deposit(
                destinationChainID,
                GenericHandlerInstance.address,
                depositData,
                {
                    value: Ethers.utils.parseEther("1.0")
                }
            )
        )
    });

    it('deposit reverts if invalid amount supplied', async () => {
        // current fee is set to 0
        assert.equals((await BridgeInstance._fee.call()).toNumber(), 0)
        // Change fee to 0.5 ether
        await BridgeInstance.adminChangeFee(Ethers.utils.parseEther("0.5"), {from: relayer})
        assert.equals((await BridgeInstance._fee.call()).toNumber(), 0.5)

        TruffleAssert.passes(
            await BridgeInstance.deposit(
                destinationChainID,
                GenericHandlerInstance.address,
                depositData,
                {
                    value: Ethers.utils.parseEther("0.5")
                }
            )
        )
    });

    it('distribute fees', async () => {
        await BridgeInstance.adminChangeFee(Ethers.utils.parseEther("1"), {from: relayer});
        assert.equals((await BridgeInstance._fee.call()).toNumber(), 0.5);

        // check the balance is 0
        assert.equals(await web3.eth.getBalance(BridgeInstance.address).toNumber(), 0);
        await BridgeInstance.deposit(destinationChainID, GenericHandlerInstance.address, depositData, {value: Ethers.utils.parseEther("1")})

        // check the balance of the future recipients
        assert.equals(await web3.eth.getBalance(accounts[1]).toNumber(), 0);
        assert.equals(await web3.eth.getBalance(accounts[2]).toNumber(), 0);

        // Transfer the funds
        TruffleAssert.passes(
            await BridgeInstance.transferFunds(
                [accounts[1], accounts[2]], 
                [Ethers.utils.parseEther("0.5"), Ethers.utils.parseEther("0.5")]
            )
        )

        assert.equals(await web3.eth.getBalance(accounts[1]).toNumber(), 0.5);
        assert.equals(await web3.eth.getBalance(accounts[2]).toNumber(), 0.5);
    })
});