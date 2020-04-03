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
    cli.url = `http://${cli.host || "localhost"}:${cli.port}`;
    cli.provider = new ethers.providers.JsonRpcProvider(cli.url);
    cli.mainWallet = new ethers.Wallet(constants.deployerPrivKey, cli.provider);
}

cli.option('-p, --port <value>', 'Port of RPC instance', 8545);
cli.option('-h, --host <value>', 'Host of RPC instance', "127.0.0.1");

cli.command("deploy")
    .description("Deploys contracts via RPC")
    .option('--chainID <value>', 'Chain ID where deposits originate from', 1)
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
        await deploy.deployCentrifugeHandler(cli);
    })
cli.command("mint")
    .description("Mints erc20 tokens")
    .option('--value <amount>', 'Amount to mint', 100)
    .option('--erc20Address <address>', 'Custom erc20 address')
    .action(async function () {
        setupCli(cli)
        cli.value = Number(cli.commands[1].value);
        cli.erc20Address = cli.commands[2].erc20Address;
        await transfer.mintErc20(cli);
    })

cli.command("transfer")
    .description("Initiates a bridge transfer")
    .option('--value <amount>', "Amount to transfer", 1)
    .option('--dest <value>', "destination chain", 1)
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .option('--erc20HandlerAddress <address>', 'Custom erc20Handler contract', constants.ERC20_HANDLER_ADDRESS)
    .option('--bridgeAddress <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option(`--recipient <address>`, 'Destination recipient address')
    .action(async function () {
        setupCli(cli)
        cli.value = Number(cli.commands[2].value);
        cli.dest = Number(cli.commands[2].dest);
        cli.erc20Address = cli.commands[2].erc20Address;
        cli.erc20HandlerAddress = cli.commands[2].erc20HandlerAddress;
        cli.bridgeAddress = cli.commands[2].bridgeAddress;
        cli.recipient = cli.commands[2].recipient
        await transfer.erc20Transfer(cli);
    })

cli.command('getCentHash')
    .description('Returns if a the given hash exists')
    .requiredOption('--hash <value>', 'A hash to lookup')
    .option('--centAddress <value>', 'Centrifuge handler contract address', constants.CENTRIFUGE_HANDLER)
    .action(async function () {
        setupCli(cli);
        cli.hash = cli.commands[3].hash;
        cli.centAddress = cli.commands[4].centAddress;
        await centrifuge.getHash(cli);
    })

cli.command('sendCentHash')
    .description('Submits a hash as a deposit')
    .requiredOption('--hash <value>', 'A hash that will be transferred')
    .option('-oc, --originChain <value>', 'The chain where the deposit will originate from', 0)
    .option('-dc, --destChain <value>', 'The cahin where the deposit will finalize', 1)
    .option('--centAddress <value>', 'Centrifuge handler contract address', constants.CENTRIFUGE_HANDLER)
    .option('--bridgeAddress <value>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function () {
        setupCli(cli);
        cli.hash = cli.commands[4].hash;
        cli.originChain = Number(cli.commands[4].originChain);
        cli.destChain = Number(cli.commands[4].destChain);
        cli.centAddress = cli.commands[4].centAddress;
        cli.bridgeAddress = cli.commands[4].bridgeAddress;
        await centrifuge.submitCentHash(cli);
    })

cli.allowUnknownOption(false);
cli.parseAsync(process.argv);
if (process.argv && process.argv.length <= 2) cli.help();