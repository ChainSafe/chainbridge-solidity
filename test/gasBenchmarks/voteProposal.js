/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");

contract('Gas Benchmark - [Vote Proposal]', async (accounts) => {
    const chainID = 1;
    const relayerThreshold = 2;
    const relayer1Address = accounts[0];
    const relayer2Address = accounts[1]
    const depositerAddress = accounts[2];
    const recipientAddress = accounts[3];
    const lenRecipientAddress = 20;
    const depositNonce = 1;
    const gasBenchmarks = [];
    
    const initialRelayers = [relayer1Address, relayer2Address];
    const erc20TokenAmount = 100;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let erc20ResourceID;

    const vote = (resourceID, depositNonce, depositDataHash, relayer) => BridgeInstance.voteProposal(chainID, depositNonce, resourceID, depositDataHash, { from: relayer });

    before(async () => {
        await Promise.all([
            BridgeContract.new(chainID, initialRelayers, relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

        const erc20InitialResourceIDs = [erc20ResourceID];
        const erc20InitialContractAddresses = [ERC20MintableInstance.address];
        const erc20BurnableContractAddresses = [];

        await ERC20HandlerContract.new(BridgeInstance.address, erc20InitialResourceIDs, erc20InitialContractAddresses, erc20BurnableContractAddresses).then(instance => ERC20HandlerInstance = instance);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, erc20TokenAmount, { from: depositerAddress }),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
        ]);
    });

    it('Should create proposal - relayerThreshold = 2, not finalized', async () => {
        const depositData = Helpers.createERCDepositData(
            erc20TokenAmount,
            lenRecipientAddress,
            recipientAddress);
        const depositDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositData.substr(2));

        const voteTx = await vote(erc20ResourceID, depositNonce, depositDataHash, relayer1Address);

        gasBenchmarks.push({
            type: 'Vote Proposal - relayerThreshold = 2, Not Finalized',
            gasUsed: voteTx.receipt.gasUsed
        });
    });

    it('Should vote proposal - relayerThreshold = 2, finalized', async () => {
        const depositData = Helpers.createERCDepositData(
            erc20TokenAmount,
            lenRecipientAddress,
            recipientAddress);
        const depositDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositData.substr(2));

        const voteTx = await vote(erc20ResourceID, depositNonce, depositDataHash, relayer2Address);

        gasBenchmarks.push({
            type: 'Vote Proposal - relayerThreshold = 2, Finalized',
            gasUsed: voteTx.receipt.gasUsed
        });
    });

    it('Should vote proposal - relayerThreshold = 1, finalized', async () => {
        const newDepositNonce = 2;
        await BridgeInstance.adminChangeRelayerThreshold(1);

        const depositData = Helpers.createERCDepositData(
            erc20TokenAmount,
            lenRecipientAddress,
            recipientAddress);
        const depositDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositData.substr(2));
        const voteTx = await vote(erc20ResourceID, newDepositNonce, depositDataHash, relayer2Address);

        gasBenchmarks.push({
            type: 'Vote Proposal - relayerThreshold = 1, Finalized',
            gasUsed: voteTx.receipt.gasUsed
        });
    });

    it('Should print out benchmarks', () => console.table(gasBenchmarks));
});
