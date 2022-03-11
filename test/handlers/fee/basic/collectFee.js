/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../../../helpers');

const BridgeContract = artifacts.require("Bridge");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");
const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");

contract('BasicFeeHandler - [collectFee]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const blankFunctionSig = '0x00000000';
    const blankFunctionDepositerOffset = 0;
    const relayer = accounts[0];
    const feeData = '0x0';

    let BridgeInstance;
    let BasicFeeHandlerInstance;
    let GenericHandlerInstance;
    let resourceID;
    let depositData;
    let initialResourceIDs;
    let initialContractAddresses;
    let initialDepositFunctionSignatures;
    let initialDepositFunctionDepositerOffsets;
    let initialExecuteFunctionSignatures;

    beforeEach(async () => {
        await Promise.all([
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
            BridgeInstance = BridgeContract.new(originDomainID, [relayer], 0, 100).then(instance => BridgeInstance = instance)
        ]);

        resourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, originDomainID)
        initialResourceIDs = [resourceID];
        initialContractAddresses = [CentrifugeAssetInstance.address];
        initialDepositFunctionSignatures = [blankFunctionSig];
        initialDepositFunctionDepositerOffsets = [blankFunctionDepositerOffset];
        initialExecuteFunctionSignatures = [blankFunctionSig];

        GenericHandlerInstance = await GenericHandlerContract.new(
            BridgeInstance.address);
        BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(
            BridgeInstance.address);

        await BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, resourceID,  initialContractAddresses[0], initialDepositFunctionSignatures[0], initialDepositFunctionDepositerOffsets[0], initialExecuteFunctionSignatures[0]);
            
        depositData = Helpers.createGenericDepositData('0xdeadbeef');
    });

    it('[sanity] Generic deposit can be made', async () => {
        await TruffleAssert.passes(BridgeInstance.deposit(
            destinationDomainID,
            resourceID,
            depositData,
            feeData
        ));
    });

    it('deposit reverts if invalid amount supplied', async () => {
        await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
        // current fee is set to 0
        assert.equal(await BasicFeeHandlerInstance._fee.call(), 0);
        
        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    value: Ethers.utils.parseEther("1.0")
                }
            )
        )
    });

    it('deposit passes if valid amount supplied', async () => {
        await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
        // current fee is set to 0
        assert.equal(await BasicFeeHandlerInstance._fee.call(), 0);
        // Change fee to 0.5 ether
        await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("0.5"));
        assert.equal(web3.utils.fromWei((await BasicFeeHandlerInstance._fee.call()), "ether"), "0.5");

        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    value: Ethers.utils.parseEther("0.5")
                }
            )
        )
    });

    it('deposit reverts if fee handler not set and fee supplied', async () => {        
        await TruffleAssert.reverts(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData,
                {
                    value: Ethers.utils.parseEther("1.0")
                }
            )
        )
    });

    it('deposit passes if fee handler not set and fee not supplied', async () => {
        await TruffleAssert.passes(
            BridgeInstance.deposit(
                destinationDomainID,
                resourceID,
                depositData,
                feeData
            )
        )
    });
});