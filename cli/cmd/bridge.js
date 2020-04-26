const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs} = require("./utils")

const registerResourceCmd = new Command("register-resource")
    .description("register a resource ID with a contract address for a handler")
    .option('--bridge <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Custom handler', constants.ERC20_HANDLER_ADDRESS)
    .option('--targetContract <address>', `Custom addresses to be whitelisted`, constants.ERC20_ADDRESS)
    .option('--resourceID <address>', `Custom resourceID to be whitelisted`, constants.ERC20_RESOURCEID)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        await bridgeInstance.adminSetResourceIDAndContractAddress(args.handler, args.resourceID, args.targetContract);
        console.log(`[BRIDGE] Successfully registered contract ${args.targetContract} with id ${args.resourceID} on handler ${args.handler}`);

    })

const setBurnCmd = new Command("set-burn")
    .description("set a a token contract as burnable in a handler")
    .option('--bridge <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Custom erc20 handler', constants.ERC20_HANDLER_ADDRESS)
    .option('--tokenContract <address>', `Custom addresses to be whitelisted`, constants.ERC20_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        await bridgeInstance.adminSetBurnable(args.handler, args.tokenContract);
        console.log(`[BRIDGE] Successfully set contract ${args.tokenContract} as burnable on handler ${args.handler}`);

    })

const bridgeCmd = new Command("bridge")

bridgeCmd.addCommand(registerResourceCmd)
bridgeCmd.addCommand(setBurnCmd)

module.exports = bridgeCmd