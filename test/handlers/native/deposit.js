// /**
//  * Copyright 2020 ChainSafe Systems
//  * SPDX-License-Identifier: LGPL-3.0-only
//  */

// const Ethers = require('ethers');

// const Helpers = require('../../helpers');

// const BridgeContract = artifacts.require("Bridge");
// const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
// const NativeAssetHandlerContract = artifacts.require("NativeAssetHandler");

// contract('NativeAssetHandler - [Deposit ETH]', async (accounts) => {
//     const relayerThreshold = 2;
//     const chainID = 1;
//     const expectedDepositNonce = 1;
//     const depositerAddress = accounts[1];
//     const depositerInitialBalance = await web3.eth.getBalance(depositerAddress);

//     let BridgeInstance;
//     let ERC20MintableInstance;
//     let NativeAssetHandlerInstance;

//     let resourceID;
//     let initialResourceIDs;
//     let initialContractAddresses;
//     let burnableContractAddresses;

//     beforeEach(async () => {
//         await Promise.all([
//             BridgeContract.new(chainID, [], relayerThreshold, 0).then(instance => BridgeInstance = instance),
//             ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
//         ]);
        
//         resourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);
//         initialResourceIDs = [resourceID];
//         initialContractAddresses = [ERC20MintableInstance.address];
//         burnableContractAddresses = []

//         await Promise.all([
//             NativeAssetHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses).then(instance => NativeAssetHandlerInstance = instance),
//         ]);

//         await Promise.all([
//             BridgeInstance.adminSetHandlerAddress(ERC20HandlerInstance.address, resourceID)
//         ]);
//     });

//     it('[sanity] depositer owns tokenAmount of ERC20', async () => {
//         const depositerBalance = await ERC20MintableInstance.balanceOf(depositerAddress);
//         assert.equal(tokenAmount, depositerBalance);
//     });

//     xit('[sanity] ERC20HandlerInstance.address has an allowance of tokenAmount from depositerAddress', async () => {
//         const handlerAllowance = await ERC20MintableInstance.allowance(depositerAddress, ERC20HandlerInstance.address);
//         assert.equal(tokenAmount, handlerAllowance);
//     });

//     xit('Varied recipient address with length 40', async () => {
//         const recipientAddress = accounts[0] + accounts[1].substr(2);
//         const lenRecipientAddress = 40;
//         const expectedDepositRecord = {
//             _tokenAddress: ERC20MintableInstance.address,
//             _destinationChainID: chainID,
//             _resourceID: resourceID,
//             _lenDestinationRecipientAddress: lenRecipientAddress,
//             _destinationRecipientAddress: recipientAddress,
//             _depositer: depositerAddress,
//             _amount: tokenAmount
//         };
        
//         await BridgeInstance.deposit(
//             chainID,
//             resourceID,
//             Helpers.createERCDepositData(
//                 resourceID,
//                 tokenAmount,
//                 lenRecipientAddress,
//                 recipientAddress),
//             { from: depositerAddress }
//         );

//         const depositRecord = await ERC20HandlerInstance.getDepositRecord(expectedDepositNonce, chainID);
//         Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, depositRecord));
//     });

//     xit('Varied recipient address with length 32', async () => {
//         const recipientAddress = Ethers.utils.keccak256(accounts[0]);
//         const lenRecipientAddress = 32;
//         const expectedDepositRecord = {
//             _tokenAddress: ERC20MintableInstance.address,
//             _destinationChainID: chainID,
//             _resourceID: resourceID,
//             _lenDestinationRecipientAddress: lenRecipientAddress,
//             _destinationRecipientAddress: recipientAddress,
//             _depositer: depositerAddress,
//             _amount: tokenAmount
//         };

//         await BridgeInstance.deposit(
//             chainID,
//             resourceID,
//             Helpers.createERCDepositData(
//                 resourceID,
//                 tokenAmount,
//                 lenRecipientAddress,
//                 recipientAddress),
//             { from: depositerAddress }
//         );

//         const depositRecord = await ERC20HandlerInstance.getDepositRecord(expectedDepositNonce, chainID);
//         Helpers.assertObjectsMatch(expectedDepositRecord, Object.assign({}, depositRecord));
//     });
// });
