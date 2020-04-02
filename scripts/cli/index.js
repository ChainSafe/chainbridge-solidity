#!/usr/bin/env node

/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const ethers = require('ethers');
const cli = require('commander');

// Comands
const {
    deploy,
    transfer,
    centrifuge,
} = require('./cmd/index');
const constants = require('./constants');

const setupCli = (cli) => {
    cli.url = `http://${process.env.BASE_URL || "localhost"}:${cli.port}`;
    cli.provider = new ethers.providers.JsonRpcProvider(cli.url);
    cli.mainWallet = new ethers.Wallet(constants.deployerPrivKey, cli.provider);
}

cli.option('-p, --port <value>', 'Port of RPC instance', 8545);
cli.option('-h, --host <value>', 'Host of RPC instance', "127.0.0.1");

cli.command("deploy")
    .description("Deploys contracts via RPC")
    .option('--chainID <value>', 'Chain ID deposits will originate from', 1)
    .option('--relayers <value>', 'Number of initial relayers', 2)
    .option('-v, --relayer-threshold <value>', 'Number of votes required for a proposal to pass', 2)
    .action(async function () {
        setupCli(cli)
        cli.chainID = Number(cli.commands[0].chainID)
        cli.relayers = cli.commands[0].relayers
        cli.relayerThreshold = cli.commands[0].relayerThreshold
        await deploy.deployRelayerContract(cli);
        await deploy.deployBridgeContract(cli);
        await deploy.deployERC20Handler(cli);
        await deploy-deployCentrifugeHandler(cli);
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

cli.command('getCentHash')
    .description('Returns if a the given hash exists')
    .requiredOption('--hash <value>', 'A hash to lookup')
    .action(async function () {
        setupCli(cli);
        cli.hash = cli.commands[3].hash;
        await centrifuge.getHash(cli);
    })


cli.allowUnknownOption(false);
cli.parseAsync(process.argv);
if (process.argv && process.argv.length <= 2) cli.help();