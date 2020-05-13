const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, splitCommaList} = require("./utils")

const mintCmd = new Command("mint")
    .description("Mints erc20 tokens")
    .option('--value <amount>', 'Amount to mint', 100)
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .action(async function (args) {
        await setupParentArgs(args, args.parent.parent)
        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        await erc20Instance.mint(args.wallet.address, args.value);
        console.log(`[ERC20 Mint] Successfully minted ${args.value} tokens to ${args.wallet.address}`);
    })

const addMinterCmd = new Command("add-minter")
    .description("Add a new minter to the contract")
    .option('--erc20Address <address>', 'erc20 contract address', constants.ERC20_ADDRESS)
    .option('--minter <address>', 'Minter address', constants.relayerAddresses[1])
    .action(async function(args) {
            await setupParentArgs(args, args.parent.parent)
            const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
            let MINTER_ROLE = await erc20Instance.MINTER_ROLE()
            await erc20Instance.grantRole(MINTER_ROLE, args.minter);
            console.log(`[ERC20 Add Minter] Added ${args.minter} as a minter of ${args.erc20Address}`)
    })


const transferCmd = new Command("transfer")
    .description("Initiates a bridge transfer")
    .option('--value <amount>', "Amount to transfer", 1)
    .option('--dest <value>', "destination chain", 1)
    .option('--recipient <address>', 'Destination recipient address', constants.relayerAddresses[4])
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .option('--erc20HandlerAddress <address>', 'Custom erc20Handler contract', constants.ERC20_HANDLER_ADDRESS)
    .option('--resourceID <resourceID>', 'Custom resourceID', constants.ERC20_RESOURCEID)
    .option('--bridgeAddress <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)

        // Instances
        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        const bridgeInstance = new ethers.Contract(args.bridgeAddress, constants.ContractABIs.Bridge.abi, args.wallet);
        const erc20HandlerInstance = new ethers.Contract(args.erc20HandlerAddress, constants.ContractABIs.Erc20Handler.abi, args.wallet);

        // Log pre balance
        const depositerPreBal = await erc20Instance.balanceOf(args.wallet.address);
        const handlerPreBal = await erc20Instance.balanceOf(args.erc20HandlerAddress);
        console.log(`[ERC20 Transfer] Initial Depositer token balance: ${depositerPreBal.toNumber()} Address: ${args.wallet.address}`);
        console.log(`[ERC20 Transfer] Initial Handler token balance: ${handlerPreBal.toNumber()} Address: ${args.erc20HandlerAddress}`);

        // Approve tokens
        await erc20Instance.approve(args.erc20HandlerAddress, args.value);
        console.log(`[ERC20 Transfer] Approved ${args.erc20HandlerAddress} to spend ${args.value} tokens from ${args.wallet.address}!`);

        // Compute resourceID
        resourceID = await erc20HandlerInstance._tokenContractAddressToResourceID(args.erc20Address)

        const data = '0x' +
            resourceID.substr(2) +              // OriginHandlerAddress  (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify(Number(args.value)), 32).substr(2) +    // Deposit Amount        (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify((args.recipient.length - 2)/2), 32).substr(2) +    // len(recipientAddress) (32 bytes)
            args.recipient.substr(2);                    // recipientAddress      (?? bytes)

        console.log(`[ERC20 Transfer] Constructed deposit:`)
        console.log(`[ERC20 Transfer]   Resource Id: ${resourceID}`)
        console.log(`[ERC20 Transfer]   Amount: ${args.value}`)
        console.log(`[ERC20 Transfer]   len(recipient): ${args.recipient.length}`)
        console.log(`[ERC20 Transfer]   Recipient: ${args.recipient}`)
        console.log(`[ERC20 Transfer]   Raw: ${data}`)

        // Make the deposit
        await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.resourceID,
            data,
        );

        console.log("[ERC20 Transfer] Created deposit to initiate transfer!");

        // Check the balance after the deposit
        const depositerPostBal = await erc20Instance.balanceOf(args.wallet.address);
        const handlerPostBal = await erc20Instance.balanceOf(args.erc20HandlerAddress);
        console.log("[ERC20 Transfer] New Depositer token balance: ", depositerPostBal.toNumber());
        console.log("[ERC20 Transfer] New Handler token balance: ", handlerPostBal.toNumber());
    })

const balanceCmd = new Command("balance")
    .description("Get the balance for an account")
    .option('--address <address>', 'Address to query', constants.deployerAddress)
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .action(async function(args) {
        setupParentArgs(args, args.parent.parent)

        const erc20Instance = new ethers.Contract(args.erc20Address, constants.ContractABIs.Erc20Mintable.abi, args.wallet);
        const balance = await erc20Instance.balanceOf(args.address)
        console.log(`[ERC20 Balance] Account ${args.address} has a balance of ${balance}` )
    })

const erc20Cmd = new Command("erc20")

erc20Cmd.addCommand(mintCmd)
erc20Cmd.addCommand(addMinterCmd)
erc20Cmd.addCommand(transferCmd)
erc20Cmd.addCommand(balanceCmd)

module.exports = erc20Cmd