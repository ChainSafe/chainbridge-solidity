const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, getFunctionBytes} = require("./utils")

const EMPTY_SIG = "0x00000000"

const registerResourceCmd = new Command("register-resource")
    .description("Register a resource ID with a contract address for a handler")
    .option('--bridge <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Custom handler', constants.ERC20_HANDLER_ADDRESS)
    .option('--targetContract <address>', `Custom addresses to be whitelisted`, constants.ERC20_ADDRESS)
    .option('--resourceID <address>', `Custom resourceID to be whitelisted`, constants.ERC20_RESOURCEID)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        await bridgeInstance.adminSetResource(args.handler, args.resourceID, args.targetContract, { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        console.log(`[BRIDGE] Successfully registered contract ${args.targetContract} with id ${args.resourceID} on handler ${args.handler}`);

    })

const registerGenericResourceCmd = new Command("register-generic-resource")
    .description("Register a resource ID with a generic handler")
    .option('--bridge <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Custom handler', constants.GENERIC_HANDLER_ADDRESS)
    .option('--targetContract <address>', `Custom addresses to be whitelisted`, constants.CENTRIFUGE_ASSET_STORE_ADDRESS)
    .option('--resourceID <address>', `Custom resourceID to be whitelisted`, constants.GENERIC_RESOURCEID)
    .option('--deposit <string>', "Function signature of the deposit functions", EMPTY_SIG)
    .option('--execute <string>', "Function signature of the proposal execution function", EMPTY_SIG)
    .option('--hash', "Treat signature inputs as function signature strings, hash and take the first 4 bytes", false)
    .action(async function(args) {
        await setupParentArgs(args, args.parent.parent)

        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        if (args.hash) {
            args.deposit = getFunctionBytes(args.deposit)
            args.execute = getFunctionBytes(args.execute)
        }

        await bridgeInstance.adminSetGenericResource(args.handler, args.resourceID, args.targetContract, args.deposit, args.execute, { gasPrice: args.gasPrice, gasLimit: args.gasLimit})
        console.log(`[BRIDGE] Successfully registered generic resource ID ${args.resourceID} on handler ${args.handler}`)
    })

const setBurnCmd = new Command("set-burn")
    .description("Set a a token contract as burnable in a handler")
    .option('--bridge <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Custom erc20 handler', constants.ERC20_HANDLER_ADDRESS)
    .option('--tokenContract <address>', `Custom addresses to be whitelisted`, constants.ERC20_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        await bridgeInstance.adminSetBurnable(args.handler, args.tokenContract, { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        console.log(`[BRIDGE] Successfully set contract ${args.tokenContract} as burnable on handler ${args.handler}`);

    })

const bridgeCmd = new Command("bridge")

bridgeCmd.addCommand(registerResourceCmd)
bridgeCmd.addCommand(registerGenericResourceCmd)
bridgeCmd.addCommand(setBurnCmd)

module.exports = bridgeCmd