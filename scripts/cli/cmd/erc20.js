const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs} = require("./utils")

const BridgeContract = require("../../../build/contracts/Bridge.json");
const ERC20MintableContract = require("../../../build/contracts/ERC20Mintable.json");
const ERC20Contract = require("../../../build/contracts/ERC20Mintable.json");

const mintCmd = new Command("mint")
    .description("Mints erc20 tokens")
    .option('--value <amount>', 'Amount to mint', 100)
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)
        const erc20Instance = new ethers.Contract(args.erc20Address, ERC20MintableContract.abi, args.wallet);
        await erc20Instance.mint(args.wallet.address, args.value);
        console.log(`[ERC20 Mint] Successfully minted ${args.value} tokens to ${args.wallet.address}`);
    })

const transferCmd = new Command("transfer")
    .description("Initiates a bridge transfer")
    .option('--value <amount>', "Amount to transfer", 1)
    .option('--dest <value>', "destination chain", 1)
    .option(`--recipient <address>`, 'Destination recipient address', constants.relayerAddresses[4])
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .option('--erc20HandlerAddress <address>', 'Custom erc20Handler contract', constants.ERC20_HANDLER_ADDRESS)
    .option('--bridgeAddress <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)

        // Instances
        const erc20Instance = new ethers.Contract(args.erc20Address, ERC20Contract.abi, args.wallet);
        const bridgeInstance = new ethers.Contract(args.bridgeAddress, BridgeContract.abi, args.wallet);

        // Log pre balance
        const depositerPreBal = await erc20Instance.balanceOf(args.wallet.address);
        const handlerPreBal = await erc20Instance.balanceOf(args.erc20HandlerAddress);
        console.log(`[ERC20 Transfer] Initial Depositer token balance: ${depositerPreBal.toNumber()} Address: ${args.wallet.address}`);
        console.log(`[ERC20 Transfer] Initial Handler token balance: ${handlerPreBal.toNumber()} Address: ${args.erc20HandlerAddress}`);

        // Approve tokens
        await erc20Instance.approve(args.erc20HandlerAddress, args.value);
        console.log(`[ERC20 Transfer] Approved ${args.erc20HandlerAddress} to spend ${args.value} tokens from ${args.wallet.address}!`);

        const data = '0x' +
            ethers.utils.hexZeroPad(erc20Instance.address, 32).substr(2) +              // OriginHandlerAddress  (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify(args.value), 32).substr(2) +    // Deposit Amount        (32 bytes)
            ethers.utils.hexZeroPad(ethers.utils.hexlify(32), 32).substr(2) +    // len(recipientAddress) (32 bytes)
            ethers.utils.hexZeroPad(args.recipient, 32).substr(2);                    // recipientAddress      (?? bytes)

        // Make the deposit
        await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.erc20HandlerAddress,
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
    .option(`--address <address>`, 'Address to query', constants.deployerAddress)
    .option('--erc20Address <address>', 'Custom erc20 address', constants.ERC20_ADDRESS)
    .action(async function(args) {
        setupParentArgs(args, args.parent.parent)

        const erc20Instance = new ethers.Contract(args.erc20Address, ERC20Contract.abi, args.wallet);
        const balance = await erc20Instance.balanceOf(args.address)
        console.log(`[ERC20 Balance] Account ${args.address} has a balance of ${balance}` )
    })

const erc20Cmd = new Command("erc20")

erc20Cmd.addCommand(mintCmd)
erc20Cmd.addCommand(transferCmd)
erc20Cmd.addCommand(balanceCmd)

module.exports = erc20Cmd