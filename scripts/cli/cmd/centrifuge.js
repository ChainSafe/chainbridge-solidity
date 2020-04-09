const ethers = require('ethers');
const {Command} = require('commander');

const {setupParentArgs} = require("./utils")

const constants = require('../constants');
const CentrifugeHandlerContract = require("../../../build/contracts/CentrifugeAssetHandler.json");
const BridgeContract = require("../../../build/contracts/Bridge.json");

const getHashCmd = new Command('getHash')
    .description('Returns if a the given hash exists')
    .requiredOption('--hash <value>', 'A hash to lookup', '0x0000000000000000000000000000000000000000000000000000000000000001')
    .option('--centAddress <value>', 'Centrifuge handler contract address', constants.CENTRIFUGE_HANDLER)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent);
        const centHandler = new ethers.Contract(args.centAddress, CentrifugeHandlerContract.abi, args.wallet);
        const res = await centHandler.getHash(ethers.utils.hexZeroPad(args.hash, 32));
        console.log(`The hash ${args.hash} was ${res ? "found!" : "NOT found!"}`);

    })

const transferHashCmd = new Command('transferHash')
    .description('Submits a hash as a deposit')
    .requiredOption('--hash <value>', 'The hash that will be transferred', '0x0000000000000000000000000000000000000000000000000000000000000001')
    .option('--dest-id <value>', 'The cahin where the deposit will finalize', 1)
    .option('--centAddress <value>', 'Centrifuge handler contract address', constants.CENTRIFUGE_HANDLER)
    .option('--bridgeAddress <value>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)
        const bridgeInstance = new ethers.Contract(args.bridgeAddress, BridgeContract.abi, args.wallet);

        const hash = ethers.utils.hexZeroPad(args.hash, 32)
        let tx = await bridgeInstance.voteDepositProposal(
            args.destId,
            args.centAddress,
            hash
        )
        console.log(`Proposal created, hash: ${tx.hash}`);
    })

const centCmd = new Command("cent")

centCmd.addCommand(getHashCmd)
centCmd.addCommand(transferHashCmd)

module.exports = centCmd
