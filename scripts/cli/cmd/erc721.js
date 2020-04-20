const ethers = require('ethers');
const constants = require('../constants');

const {Command} = require('commander');
const {setupParentArgs, splitCommaList} = require("./utils")

const BridgeContract = require("../../../build/contracts/Bridge.json");
const ERC721Contract = require("../../../build/contracts/ERC721Mintable.json");
const ERC721HandlerContract = require("../../../build/contracts/ERC721Handler.json");


const mintCmd = new Command("mint")
    .option('--erc721Address <address>', 'Custom erc721 contract', constants.ERC721_ADDRESS)
    .option('--id <id>', "ERC721 token id", 1)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)
        let erc721Instance = new ethers.Contract(args.erc721Address, ERC721Contract.abi, args.wallet);
        await erc721Instance.mint(args.wallet.address, args.id);
        console.log(`[ERC721 Mint] Minted token with id ${args.id} to ${args.wallet.address}!`);
    })

const whitelistCmd = new Command("whitelist")
    .description("whitelists token addresses for a particular handler")
    .option('--bridgeAddress <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)
    .option(`--tokenContract <address>`, `Custom addresses to be whitelisted`, constants.ERC721_ADDRESS)
    .option(`--resourceID <address>`, `Custom resourceID to be whitelisted`, constants.ERC721_RESOURCEID)
    .option('--erc721HandlerAddress <address>', 'Custom erc721 handler', constants.ERC721_HANDLER_ADDRESS)
    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)

        // Instances
        const bridgeInstance = new ethers.Contract(args.bridgeAddress, BridgeContract.abi, args.wallet);
        const erc721HandlerInstance = new ethers.Contract(args.erc721HandlerAddress, ERC721HandlerContract.abi, args.wallet);

        // Whitelisting Addresses
        chainID = await bridgeInstance._chainID()

        await erc721HandlerInstance.setResourceIDAndContractAddress(args.resourceID, args.tokenContract);
        console.log(`[ERC721 Whitelist] Successfully whitelisted ${args.tokenContract} on handler ${args.erc721HandlerAddress}`);

    })

const transferCmd = new Command("transfer")
    .description("Initiates a bridge transfer")
    .option('--id <id>', "ERC721 token id", 1)
    .option('--dest <value>', "destination chain", 1)
    .option(`--recipient <address>`, 'Destination recipient address', constants.relayerAddresses[4])
    .option('--erc721Address <address>', 'Custom erc721 contract', constants.ERC721_ADDRESS)
    .option('--erc721HandlerAddress <address>', 'Custom erc721 handler', constants.ERC721_HANDLER_ADDRESS)
    .option('--bridgeAddress <address>', 'Custom bridge address', constants.BRIDGE_ADDRESS)

    .action(async function (args) {
        setupParentArgs(args, args.parent.parent)

        // Instances
        const erc721Instance = new ethers.Contract(args.erc721Address, ERC721Contract.abi, args.wallet);
        const bridgeInstance = new ethers.Contract(args.bridgeAddress, BridgeContract.abi, args.wallet);
        const erc721HandlerInstance = new ethers.Contract(args.erc721HandlerAddress, ERC721HandlerContract.abi, args.wallet);

        // Approve tokens
        await erc721Instance.approve(args.erc721HandlerAddress, args.id);
        console.log("[ERC721 Transfer] Approved tokens!");
        console.log(`[ERC721 Transfer] Approved ${args.erc721HandlerAddress} to move ${args.id} on behalf of ${args.wallet.address}!`);

        // Check pre balance
        const depositerPreBal = await erc721Instance.balanceOf(args.wallet.address);
        const handlerPreBal = await erc721Instance.balanceOf(args.erc721HandlerAddress);
        console.log(`[ERC721 Transfer] Depositer ${args.wallet.address} owns ${depositerPreBal.toNumber()} tokens `);
        console.log(`[ERC721 Transfer] Handler ${args.erc721HandlerAddress} owns ${handlerPreBal.toNumber()}`);


        // Compute resourceID
        resourceID = await erc721HandlerInstance._tokenContractAddressToResourceID(args.erc721Address)

        const data = '0x' +
            resourceID.substr(2) +              // OriginHandlerAddress  (32 bytes)          
            ethers.utils.hexZeroPad(ethers.utils.hexlify(args.id), 32).substr(2) +      // Token ID
            ethers.utils.hexZeroPad(ethers.utils.hexlify(32), 32).substr(2) +    // len(recipientAddress) (32 bytes)
            ethers.utils.hexZeroPad(args.recipient, 32).substr(2);                    // recipientAddress      (?? bytes)

        // // Perform deposit
        await bridgeInstance.deposit(
            args.dest, // destination chain id
            args.erc721HandlerAddress,
            data,);
        console.log("[ERC721 Transfer] Created deposit to initiate transfer!")

        const depositerPostBal = await erc721Instance.balanceOf(args.wallet.address);
        const handlerPostBal = await erc721Instance.balanceOf(args.erc721HandlerAddress);
        console.log(`[ERC721 Transfer] Depositer ${args.wallet.address} owns ${depositerPostBal.toNumber()} tokens `);
        console.log(`[ERC721 Transfer] Handler ${args.erc721HandlerAddress} owns ${handlerPostBal.toNumber()}`);
    })

const erc721Cmd = new Command("erc721")

erc721Cmd.addCommand(mintCmd)
erc721Cmd.addCommand(whitelistCmd)
erc721Cmd.addCommand(transferCmd)

module.exports = erc721Cmd