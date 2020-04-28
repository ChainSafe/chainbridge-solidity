const ethers = require('ethers');
const {Command} = require('commander');
const constants = require('../constants');
const {setupParentArgs, splitCommaList} = require("./utils")

const deployCmd = new Command("deploy")
    .description("Deploys contracts via RPC")
    .option('--chain-id <value>', 'Chain ID for the instance', constants.DEFAULT_SOURCE_ID)
    .option('--relayers <value>', 'List of initial relayers', splitCommaList, constants.relayerAddresses)
    .option('--relayer-threshold <value>', 'Number of votes required for a proposal to pass', 2)
    .option('--fee <ether>', 'Fee to be taken when making a deposit (decimals allowed)', 0)
    .action(async (args, a) => {
        await setupParentArgs(args, args.parent)
        let startBal = await args.provider.getBalance(args.wallet.address)
        console.log("Deploying contracts...")
        await deployBridgeContract(args);
        await deployERC20(args)
        await deployERC20Handler(args);
        await deployERC721(args)
        await deployERC721Handler(args)
        await deployGenericHandler(args)
        await deployCentrifugeAssetStore(args);
        args.cost = startBal.sub((await args.provider.getBalance(args.wallet.address)))
        displayLog(args)
    })


const displayLog = (args) => {
    console.log(`
================================================================
Url:        ${args.url}
Deployer:   ${args.wallet.address}
Chain Id:   ${args.chainId}
Threshold:  ${args.relayerThreshold}
Relayers:   ${args.relayers}
Fee:        ${args.fee} ETH
Cost:       ${ethers.utils.formatEther(args.cost)}

Contract Addresses
================================================================
Bridge:             ${args.bridgeContract}
----------------------------------------------------------------
Erc20:              ${args.erc20Contract}
----------------------------------------------------------------
Erc20 Handler:      ${args.erc20HandlerContract}
----------------------------------------------------------------
Erc721:             ${args.erc721Contract}
----------------------------------------------------------------
Erc721 Handler:     ${args.erc721HandlerContract}
----------------------------------------------------------------
Generic Handler:    ${args.genericHandlerContract}
----------------------------------------------------------------
Centrifuge Asset:   ${args.centrifugeAssetStoreContract}
================================================================
        `)
}


async function deployBridgeContract(args) {
    // Create an instance of a Contract Factory
    let factory = new ethers.ContractFactory(constants.ContractABIs.Bridge.abi, constants.ContractABIs.Bridge.bytecode, args.wallet);

    // Deploy
    let contract = await factory.deploy(
        args.chainId,
        args.relayers,
        args.relayerThreshold,
        ethers.utils.parseEther(args.fee.toString())
    );
    await contract.deployed();
    args.bridgeContract = contract.address
    console.log("✓ Bridge contract deployed")
}

async function deployERC20(args) {
    const factory = new ethers.ContractFactory(constants.ContractABIs.Erc20Mintable.abi, constants.ContractABIs.Erc20Mintable.bytecode, args.wallet);
    const contract = await factory.deploy("", "");
    await contract.deployed();
    args.erc20Contract = contract.address
    console.log("✓ ERC20 contract deployed")
}

async function deployERC20Handler(args) {
    const factory = new ethers.ContractFactory(constants.ContractABIs.Erc20Handler.abi, constants.ContractABIs.Erc20Handler.bytecode, args.wallet);


    const contract = await factory.deploy(args.bridgeContract, [], [], []);
    await contract.deployed();
    args.erc20HandlerContract = contract.address
    console.log("✓ ERC20Handler contract deployed")
}

async function deployERC721(args) {
    const factory = new ethers.ContractFactory(constants.ContractABIs.Erc721Mintable.abi, constants.ContractABIs.Erc721Mintable.bytecode, args.wallet);
    const contract = await factory.deploy("", "", "");
    await contract.deployed();
    args.erc721Contract = contract.address
    console.log("✓ ERC721 contract deployed")
}

async function deployERC721Handler(args) {
    const factory = new ethers.ContractFactory(constants.ContractABIs.Erc721Handler.abi, constants.ContractABIs.Erc721Handler.bytecode, args.wallet);
    const contract = await factory.deploy(args.bridgeContract,[],[],[]);
    await contract.deployed();
    args.erc721HandlerContract = contract.address
    console.log("✓ ERC721Handler contract deployed")
}

async function deployGenericHandler(args) {
    const factory = new ethers.ContractFactory(constants.ContractABIs.GenericHandler.abi, constants.ContractABIs.GenericHandler.bytecode, args.wallet)
    const contract = await factory.deploy(args.bridgeContract, [], [], [], [])
    await contract.deployed();
    args.genericHandlerContract = contract.address
    console.log("✓ GenericHandler contract deployed")
}

async function deployCentrifugeAssetStore(args) {
    const factory = new ethers.ContractFactory(constants.ContractABIs.CentrifugeAssetStore.abi, constants.ContractABIs.CentrifugeAssetStore.bytecode, args.wallet);
    const contract = await factory.deploy();
    await contract.deployed();
    args.centrifugeAssetStoreContract = contract.address
    console.log("✓ CentrifugeAssetStore contract deployed")
}

module.exports = deployCmd