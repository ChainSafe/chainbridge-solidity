/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const ethers = require('ethers');
const constants = require('../constants');

const BridgeContract = require("../../../build/contracts/Bridge.json");
const RelayerContract = require("../../../build/contracts/Relayer.json");
const ERC20HandlerContract = require("../../../build/contracts/ERC20Handler.json");
const ERC20MintableContract = require("../../../build/contracts/ERC20Mintable.json");

async function deployRelayerContract(cfg) {
    try {
        // Create an instance of a Contract Factory
        let factory = new ethers.ContractFactory(RelayerContract.abi, RelayerContract.bytecode, cfg.mainWallet);

        // Set relayers
        const relayers = constants.relayerAddresses.slice(0, cfg.numRelayers);

        // Deploy
        let contract = await factory.deploy(
            relayers,
            cfg.relayerThreshold
        );
        console.log("[Relayer] Initial Relayers: ", relayers)
        console.log("[Relayer] Relayer Threshold: ", cfg.relayerThreshold)
        console.log("[Relayer] Contract address: ", contract.address);
        console.log("[Relayer] Transaction Hash: ", contract.deployTransaction.hash);
        await contract.deployed();
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

async function deployBridgeContract(cfg) {
    try {
        // Create an instance of a Contract Factory
        let factory = new ethers.ContractFactory(BridgeContract.abi, BridgeContract.bytecode, cfg.mainWallet);

        // Deploy
        let contract = await factory.deploy(
            cfg.chainID,
            constants.RELAYER_ADDRESS,
            cfg.relayerThreshold
        );
        console.log("[Bridge] ChainID: ", cfg.chainID)
        console.log("[Bridge] Relayer Threshold: ", cfg.relayerThreshold)
        console.log("[Bridge] Contract address: ", contract.address);
        console.log("[Bridge] Transaction Hash: ", contract.deployTransaction.hash);
        await contract.deployed();
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

async function deployERC20Handler(cfg) {
    try {
        const handlerFactory = new ethers.ContractFactory(ERC20HandlerContract.abi, ERC20HandlerContract.bytecode, cfg.mainWallet);
        const erc20MintableFactory = new ethers.ContractFactory(ERC20MintableContract.abi, ERC20MintableContract.bytecode, cfg.mainWallet);
        const handlerContract = await handlerFactory.deploy(constants.BRIDGE_ADDRESS);
        const erc20MintableContract = await erc20MintableFactory.deploy();

        console.log("[ERC20 Handler] Contract address: ", handlerContract.address);
        console.log("[ERC20 Handler] Transaction Hash: ", handlerContract.deployTransaction.hash);

        console.log("[ERC20 Token] Contract address: ", erc20MintableContract.address);
        console.log("[ERC20 Token] Transaction Hash: ", erc20MintableContract.deployTransaction.hash);
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

module.exports = {
    deployRelayerContract,
    deployBridgeContract,
    deployERC20Handler,
}