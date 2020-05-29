const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, waitForTx} = require("./utils")

const mintCmd = new Command("mint")
    .description("Mints erc20 tokens")
    .option('--amount <value>', 'Amount to mint', 100)
    .option('--erc20Address <address>', 'ERC20 contract address', constants.ERC20_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        console.log(`To: ${args.wallet.address} Amount: ${args.amount} Contract: ${constants.ERC20_ADDRESS}`)
        const tx = await erc20Instance.mint(args.wallet.address, args.amount);
        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC20 Mint] Minted ${args.amount} tokens to ${args.wallet.address}`);
    })

const addMinterCmd = new Command("add-minter")
    .description("Add a new minter to the contract")
    .option('--erc20Address <address>', 'ERC20 contract address', constants.ERC20_ADDRESS)
    .option('--minter <address>', 'Minter address', constants.relayerAddresses[1])
    .action(async function(args) {
        await setupParentArgs(args, args.parent.parent)
        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        let MINTER_ROLE = await erc20Instance.MINTER_ROLE()
        const tx = await erc20Instance.grantRole(MINTER_ROLE, args.minter);
        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC20 Add Minter] Added ${args.minter} as a minter of ${args.erc20Address}`)
    })

const approveCmd = new Command("approve")
    .description("Approve tokens for transfer")
    .option('--amount <value>', "Amount to transfer", 1)
    .option('--recipient <address>', 'Destination recipient address', constants.ERC20_HANDLER_ADDRESS)
    .option('--erc20Address <address>', 'ERC20 contract address', constants.ERC20_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        const tx = await erc20Instance.approve(args.recipient, args.amount, { gasPrice: args.gasPrice, gasLimit: args.gasLimit});
        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC20 Approve] Approved ${args.recipient} to spend ${args.amount} tokens from ${args.wallet.address}!`);
    })

const depositCmd = new Command("deposit")
    .description("Initiates a bridge transfer")
    .option('--amount <value>', "Amount to transfer", 1)
    .option('--dest <id>', "Destination chain ID", 1)
    .option('--recipient <address>', 'Destination recipient address', constants.relayerAddresses[4])
    .option('--resourceId <id>', 'ResourceID for transfer', constants.ERC20_RESOURCEID)
    .option('--bridge <address>', 'Bridge contract address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridge, constants.ContractABIs.Bridge.abi, args.wallet);

        const data = '0x' +
            args.resourceId.substr(2) +              // OriginHandlerAddress  (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify(Number(args.amount)), 32).substr(2) +    // Deposit Amount        (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify((args.recipient.length - 2)/2), 32).substr(2) +    // len(recipientAddress) (32 bytes)
            args.recipient.substr(2);                    // recipientAddress      (?? bytes)

        console.log(`[ERC20 Deposit] Constructed deposit:`)
        console.log(`[ERC20 Deposit]   Resource Id: ${args.resourceId}`)
        console.log(`[ERC20 Deposit]   Amount: ${args.amount}`)
        console.log(`[ERC20 Deposit]   len(recipient): ${(args.recipient.length - 2)/ 2}`)
        console.log(`[ERC20 Deposit]   Recipient: ${args.recipient}`)
        console.log(`[ERC20 Deposit]   Raw: ${data}`)

        // Make the deposit
        let tx = await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.resourceId,
            data,
            { gasPrice: args.gasPrice, gasLimit: args.gasLimit}
        );

        await waitForTx(args.provider, tx.hash)
        console.log(`[ERC20 Deposit] Created deposit to initiate transfer!`);
    })

const balanceCmd = new Command("balance")
    .description("Get the balance for an account")
    .option('--address <address>', 'Address to query', constants.deployerAddress)
    .option('--erc20Address <address>', 'ERC20 contract address', constants.ERC20_ADDRESS)
    .action(async function(args) {
        await setupParentArgs(args, args.parent.parent)

        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        const balance = await erc20Instance.balanceOf(args.address)
        console.log(`[ERC20 Balance] Account ${args.address} has a balance of ${balance}` )
    })

const erc20Cmd = new Command("erc20")

erc20Cmd.addCommand(mintCmd)
erc20Cmd.addCommand(addMinterCmd)
erc20Cmd.addCommand(approveCmd)
erc20Cmd.addCommand(depositCmd)
erc20Cmd.addCommand(balanceCmd)

module.exports = erc20Cmd