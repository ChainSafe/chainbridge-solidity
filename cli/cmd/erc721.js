const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, waitForTx} = require("./utils")

const mintCmd = new Command("mint")
    .description("Mint tokens")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", 1)
    .option('--metadata <bytes>', "Metadata (tokenURI) for token", "")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const tx = await erc721Instance.mint(args.wallet.address, args.id, args.metadata);
        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC721 Mint] Minted token with id ${args.id} to ${args.wallet.address}!`);
    })

const ownerCmd = new Command("owner")
    .description("Query ownerOf")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", 1)
    .action(async function (args) {
            await setupParentArgs(args, args.parent.parent)
            const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
            const owner = await erc721Instance.ownerOf(args.id)
            console.log(`[ERC721] Owner of token ${args.id} is ${owner}`)
    })

const addMinterCmd = new Command("add-minter")
    .description("Add a new minter to the contract")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--minter <address>', 'Minter address', constants.relayerAddresses[1])
    .action(async function(args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const MINTER_ROLE = await erc721Instance.MINTER_ROLE()
        const tx = await erc721Instance.grantRole(MINTER_ROLE, args.minter);
        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC721 Add Minter] Added ${args.minter} as a minter of ${args.erc721Address}`)
    })

const approveCmd = new Command("approve")
    .description("Approve tokens for transfer")
    .option('--id <id>', "Token ID to transfer", 1)
    .option('--recipient <address>', 'Destination recipient address', constants.ERC721_HANDLER_ADDRESS)
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const tx = await erc721Instance.approve(args.recipient, args.id, { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC721 Approve] Approved ${args.recipient} to spend token ${args.id} from ${args.wallet.address}!`);
    })

const depositCmd = new Command("deposit")
    .description("Initiates a bridge transfer")
    .option('--id <id>', "ERC721 token id", 1)
    .option('--dest <value>', "destination chain", 1)
    .option(`--recipient <address>`, 'Destination recipient address', constants.relayerAddresses[4])
    .option('--resourceId <resourceID>', 'Resource ID for transfer', constants.ERC721_RESOURCEID)
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        const data = '0x' +
            args.resourceId.substr(2) +                                                  // resourceID            (32 bytes) for now
            ethers.utils.hexZeroPad(ethers.utils.hexlify(args.id), 32).substr(2) +  // Deposit Amount        (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify((args.recipient.length - 2)/2), 32).substr(2) +       // len(recipientAddress) (32 bytes)
            ethers.utils.hexlify(args.recipient).substr(2)                // recipientAddress      (?? bytes)

        console.log(`[ERC721 Deposit] Constructed deposit:`)
        console.log(`[ERC721 Deposit]   Resource Id: ${args.resourceId}`)
        console.log(`[ERC721 Deposit]   Token Id: ${args.id}`)
        console.log(`[ERC721 Deposit]   len(recipient): ${(args.recipient.length - 2)/2}`)
        console.log(`[ERC721 Deposit]   Recipient: ${args.recipient}`)
        console.log(`[ERC721 Deposit]   Raw: ${data}`)

        // Perform deposit
        const tx = await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.resourceId,
            data,
            { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
        console.log("[ERC721 Deposit] Created deposit to initiate transfer!")
    })

const erc721Cmd = new Command("erc721")

erc721Cmd.addCommand(mintCmd)
erc721Cmd.addCommand(ownerCmd)
erc721Cmd.addCommand(addMinterCmd)
erc721Cmd.addCommand(approveCmd)
erc721Cmd.addCommand(depositCmd)

module.exports = erc721Cmd
