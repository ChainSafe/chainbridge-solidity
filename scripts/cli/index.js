#!/usr/bin/env node

/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const ethers = require('ethers');
const cli = require('commander');

const deploy = require('./cmd/deployment');
const transfer = require('./cmd/transfer');
const constants = require('./constants');


const setupCli = (cli) => {
    cli.url = `http://${process.env.BASE_URL || "localhost"}:${cli.port}`;
    cli.provider = new ethers.providers.JsonRpcProvider(cli.url);
    cli.mainWallet = new ethers.Wallet(constants.deployerPrivKey, cli.provider);
}

cli.option('-p, --port <value>', 'Port of RPC instance', 8545)

cli.command("deploy")
    .description("Deploys contracts via RPC")
    .option('--chainID <value>', 'Chain ID deposits will originate from', 1)
    .option('--relayers <value>', 'Number of initial relayers', 2)
    .option('-v, --relayer-threshold <value>', 'Number of votes required for a proposal to pass', 2)
    .action(async function () {
        setupCli(cli)
        cli.chainID = cli.commands[0].chainID
        cli.relayers = cli.commands[0].relayers
        cli.relayerThreshold = cli.commands[0].relayerThreshold
        await deploy.deployRelayerContract(cli);
        await deploy.deployBridgeContract(cli);
        await deploy.deployERC20Handler(cli);
    })
cli.command("mint")
    .description("Mints erc20 tokens")
    .option('--value <amount>', "Amount to mint", 100)
    .action(async function () {
        setupCli(cli)
        cli.value = Number(cli.commands[1].value);
        await transfer.mintErc20(cli);
    })

cli.command("transfer")
    .description("Initiates a bridge transfer")
    .option('--value <amount>', "Amount to transfer", 1)
    .option('--dest <value>', "destination chain", 1)
    .action(async function () {
        setupCli(cli)
        cli.value = Number(cli.commands[2].value);
        cli.dest = Number(cli.commands[2].dest);

        await transfer.erc20Transfer(cli);
    })

cli.parseAsync(process.argv);
