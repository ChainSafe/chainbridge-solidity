const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, waitForTx, log} = require("./utils")

const isRelayerCmd = new Command("is-relayer")
    .description("Check if address is relayer")
    .option('--relayer <value>', 'Address to check', constants.relayerAddresses[0])
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
            await setupParentArgs(args, args.parent.parent)
            const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

            let res = await bridgeInstance.isRelayer(args.relayer)
            console.log(`[${args._name}] Address ${args.relayer} ${res ? "is" : "is not"} a relayer.`)
    })

const addRelayerCmd = new Command("add-relayer")
    .description("Add a relayer")
    .option('--relayer <address>', 'Address of relayer', constants.relayerAddresses[0])
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Adding ${args.relayer} as a relayer.`)
        let tx = await bridgeInstance.adminAddRelayer(args.relayer)
        await waitForTx(args.provider, tx.hash)
    })

const removeRelayerCmd = new Command("remove-relayer")
    .description("Remove a relayer")
    .option('--relayer <address>', 'Address of relayer', constants.relayerAddresses[0])
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Removing relayer ${args.relayer}.`)
        let tx = await bridgeInstance.adminRemoveRelayer(args.relayer)
        await waitForTx(args.provider, tx.hash)
    })

const setThresholdCmd = new Command("set-threshold")
    .description("Set relayer threshold")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--threshold <value>', 'New relayer threshold', 3)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Setting relayer threshold to ${args.threshold}`)
        let tx = await bridgeInstance.adminChangeRelayerThreshold(args.threshold)
        await waitForTx(args.provider, tx.hash)
    })

const pauseTransfersCmd = new Command("pause")
    .description("Pause deposits and proposal on the bridge")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Pausing deposits and proposals`)
        let tx = await bridgeInstance.adminPauseTransfers()
        await waitForTx(args.provider, tx.hash)
    })

const unpauseTransfersCmd = new Command("unpause")
    .description("Unpause deposits and proposals on the bridge")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Unpausing deposits and proposals`)
        let tx = await bridgeInstance.adminUnpauseTransfers()
        await waitForTx(args.provider, tx.hash)
    })

const changeFeeCmd = new Command("set-fee")
    .description("Set a new fee for deposits")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--fee <value>', 'New fee (in wei)', 0)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Setting fee to ${args.fee} wei`)
        let tx = await bridgeInstance.adminChangeFee(args.fee)
        await waitForTx(args.provider, tx.hash)
    })

const withdrawCmd = new Command("withdraw")
    .description("Withdraw funds collected from fees")
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .option('--handler <address>', 'Handler contract address', constants.ERC20_HANDLER_ADDRESS)
    .option('--tokenContract <address>', 'ERC20 or ERC721 token contract address', constants.ERC20_ADDRESS)
    .option('--recipient <address>', 'Address to withdraw to', constants.relayerAddresses[0])
    .option('--amountOrId <value>', 'Token ID or amount to withdraw', 1)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);
        log(args, `Withdrawing tokens (${args.amountOrId}) in contract ${args.tokenContract} to recipient ${args.recipient}`)
        let tx = await bridgeInstance.adminWithdraw(args.handler, args.tokenContract, args.recipient, args.amountOrId)
        await waitForTx(args.provider, tx.hash)
    })

const adminCmd = new Command("admin")

adminCmd.addCommand(isRelayerCmd)
adminCmd.addCommand(addRelayerCmd)
adminCmd.addCommand(removeRelayerCmd)
adminCmd.addCommand(setThresholdCmd)
adminCmd.addCommand(pauseTransfersCmd)
adminCmd.addCommand(unpauseTransfersCmd)
adminCmd.addCommand(changeFeeCmd)
adminCmd.addCommand(withdrawCmd)

module.exports = adminCmd