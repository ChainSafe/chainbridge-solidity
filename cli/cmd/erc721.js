const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, waitForTx, log} = require("./utils")

const mintCmd = new Command("mint")
    .description("Mint tokens")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", "0x1")
    .option('--metadata <bytes>', "Metadata (tokenURI) for token", "")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);

        log(args, `Minting token with id ${args.id} to ${args.wallet.address} on contract ${args.erc721Address}!`);
        const tx = await erc721Instance.mint(args.wallet.address, ethers.utils.hexlify(args.id), args.metadata);
        await waitForTx(args.provider, tx.hash)
    })

const ownerCmd = new Command("owner")
    .description("Query ownerOf")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--id <id>', "Token id", "0x1")
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const owner = await erc721Instance.ownerOf(ethers.utils.hexlify(args.id))
        log(args, `Owner of token ${args.id} is ${owner}`)
    })

const addMinterCmd = new Command("add-minter")
    .description("Add a new minter to the contract")
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .option('--minter <address>', 'Minter address', constants.relayerAddresses[1])
    .action(async function(args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);
        const MINTER_ROLE = await erc721Instance.MINTER_ROLE()
        log(args, `Adding ${args.minter} as a minter of ${args.erc721Address}`)
        const tx = await erc721Instance.grantRole(MINTER_ROLE, args.minter);
        await waitForTx(args.provider, tx.hash)
    })

const approveCmd = new Command("approve")
    .description("Approve tokens for transfer")
    .option('--id <id>', "Token ID to transfer", "0x1")
    .option('--recipient <address>', 'Destination recipient address', constants.ERC721_HANDLER_ADDRESS)
    .option('--erc721Address <address>', 'ERC721 contract address', constants.ERC721_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc721Instance = new ethers.Contract(args.erc721Address, constants.ContractABIs.Erc721Mintable.abi, args.wallet);

        log(args, `Approving ${args.recipient} to spend token ${args.id} from ${args.wallet.address} on contract ${args.erc721Address}!`);
        const tx = await erc721Instance.approve(args.recipient, ethers.utils.hexlify(args.id), { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
    })

const depositCmd = new Command("deposit")
    .description("Initiates a bridge transfer")
    .option('--id <id>', "ERC721 token id", "0x1")
    .option('--dest <value>', "destination chain", "1")
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

        log(args, `Constructed deposit:`)
        log(args, `  Resource Id: ${args.resourceId}`)
        log(args, `  Token Id: ${args.id}`)
        log(args, `  len(recipient): ${(args.recipient.length - 2)/2}`)
        log(args, `  Recipient: ${args.recipient}`)
        log(args, `  Raw: ${data}`)
        log(args, "Creating deposit to initiate transfer!")

        // Perform deposit
        const tx = await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.resourceId,
            data,
            { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
    })

const erc721Cmd = new Command("erc721")

erc721Cmd.addCommand(mintCmd)
erc721Cmd.addCommand(ownerCmd)
erc721Cmd.addCommand(addMinterCmd)
erc721Cmd.addCommand(approveCmd)
erc721Cmd.addCommand(depositCmd)

module.exports = erc721Cmd
