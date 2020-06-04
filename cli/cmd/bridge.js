const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, getFunctionBytes, waitForTx, log} = require("./utils")

const EMPTY_SIG = "0x00000000"

const registerResourceCmd = new Command("register-resource")
    .description("Register a resource ID with a contract address for a handler")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Handler address', constants.ERC20_HANDLER_ADDRESS)
    .option('--targetContract <address>', `Contract address to be registered`, constants.ERC20_ADDRESS)
    .option('--resourceId <address>', `Resource ID to be registered`, constants.ERC20_RESOURCEID)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args,`Registering contract ${args.targetContract} with resource ID ${args.resourceId} on handler ${args.handler}`);
        const tx = await bridgeInstance.adminSetResource(args.handler, args.resourceId, args.targetContract, { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
    })

const registerGenericResourceCmd = new Command("register-generic-resource")
    .description("Register a resource ID with a generic handler")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Handler contract address', constants.GENERIC_HANDLER_ADDRESS)
    .option('--targetContract <address>', `Contract address to be registered`, constants.CENTRIFUGE_ASSET_STORE_ADDRESS)
    .option('--resourceId <address>', `ResourceID to be registered`, constants.GENERIC_RESOURCEID)
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

        log(args,`Registering generic resource ID ${args.resourceId} with contract ${args.targetContract} on handler ${args.handler}`)
        const tx = await bridgeInstance.adminSetGenericResource(args.handler, args.resourceId, args.targetContract, args.deposit, args.execute, { gasPrice: args.gasPrice, gasLimit: args.gasLimit})
        await waitForTx(args.provider, tx.hash)
    })

const setBurnCmd = new Command("set-burn")
    .description("Set a token contract as burnable in a handler")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'ERC20 handler contract address', constants.ERC20_HANDLER_ADDRESS)
    .option('--tokenContract <address>', `Token contract to be registered`, constants.ERC20_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        log(args,`Setting contract ${args.tokenContract} as burnable on handler ${args.handler}`);
        const tx = await bridgeInstance.adminSetBurnable(args.handler, args.tokenContract, { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
    })

const queryProposalCmd = new Command("query-proposal")
    .description("Query a proposal on-chain")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--depositNonce <address>', 'Nonce of proposal', 0)
    .option('--chainId <id>', 'Source chain ID of proposal', constants.DEFAULT_SOURCE_ID)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        const prop = await bridgeInstance.getProposal(args.chainId, args.depositNonce)
        log(args, `Source: ${args.chainId} Nonce: ${args.depositNonce}`)
        log(args, `Votes: ${prop._yesVotes} Status: ${prop._status}`)
    })


const cancelProposalCmd = new Command("cancel-proposal")
    .description("Cancel a proposal that has passed the expiry threshold")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--chainId <id>', 'Chain ID of proposal to cancel', 0)
    .option('--depositNonce <value>', 'Deposit nonce of proposal to cancel', 0)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        log(args, `Setting proposal with chain ID ${args.chainId} and deposit nonce ${args.depositNonce} status to 'Cancelled`);
        const tx = await bridgeInstance.adminCancelProposal(args.chainId, args.depositNonce);
        await waitForTx(args.provider, tx.hash)
    })

const bridgeCmd = new Command("bridge")

bridgeCmd.addCommand(registerResourceCmd)
bridgeCmd.addCommand(registerGenericResourceCmd)
bridgeCmd.addCommand(setBurnCmd)
bridgeCmd.addCommand(queryProposalCmd)
bridgeCmd.addCommand(cancelProposalCmd)

module.exports = bridgeCmd