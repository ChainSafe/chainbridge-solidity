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
    const domainID = 1;
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

    const vote = (resourceID, depositNonce, depositData, relayer) => BridgeInstance.voteProposal(domainID, depositNonce, resourceID, depositData, { from: relayer });

    before(async () => {
        await Promise.all([
            BridgeContract.new(domainID, initialRelayers, relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
        ]);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, domainID);

        await ERC20HandlerContract.new(BridgeInstance.address).then(instance => ERC20HandlerInstance = instance);

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

        const voteTx = await vote(erc20ResourceID, depositNonce, depositData, relayer1Address);

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

        const voteTx = await vote(erc20ResourceID, depositNonce, depositData, relayer2Address);

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
        const voteTx = await vote(erc20ResourceID, newDepositNonce, depositData, relayer2Address);

        gasBenchmarks.push({
            type: 'Vote Proposal - relayerThreshold = 1, Finalized',
            gasUsed: voteTx.receipt.gasUsed
        });
    });

    it('Should print out benchmarks', () => console.table(gasBenchmarks));
});
