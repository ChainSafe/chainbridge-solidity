#!/usr/bin/env node

const {Command} = require('commander');
const program = new Command();

// Comands
const {
    deploy,
    erc20,
    erc721,
    centrifuge,
} = require('./cmd/index');
const constants = require('./constants');


program.option('-p, --port <value>', 'Port of RPC instance', 8545);
program.option('-h, --host <value>', 'Host of RPC instance', "127.0.0.1");
program.option('--private-key <value>', 'Private key to use', constants.deployerPrivKey);

program.addCommand(deploy)
program.addCommand(erc20)
program.addCommand(erc721)
program.addCommand(centrifuge)

program.allowUnknownOption(false);

const run = async () => {
    try {
        await program.parseAsync(process.argv);
    } catch (e) {
        console.log({ e });
        process.exit(1)
    }
}


if (process.argv && process.argv.length <= 2) {
    program.help();
} else {
    run()
}