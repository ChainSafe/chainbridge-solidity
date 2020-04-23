/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const ethers = require('ethers');

const CONTRACT_PATH = "../"
const ContractABIs = {
    Bridge: require(CONTRACT_PATH + "/build/contracts/Bridge.json"),
    Relayer: require(CONTRACT_PATH + "/build/contracts/Relayer.json"),
    Erc20Handler: require(CONTRACT_PATH + "/build/contracts/ERC20Handler.json"),
    Erc20Mintable: require(CONTRACT_PATH + "/build/contracts/ERC20PresetMinterPauser.json"),
    Erc721Handler: require(CONTRACT_PATH + "/build/contracts/ERC721Handler.json"),
    Erc721Mintable: require(CONTRACT_PATH + "/build/contracts/ERC721MinterBurnerPauser.json"),
    CentrifugeHandler: require(CONTRACT_PATH + "/build/contracts/CentrifugeAssetHandler.json")
}

module.exports.ContractABIs = ContractABIs
// This is just Alice's key.
module.exports.deployerAddress = "0xff93B45308FD417dF303D6515aB04D9e89a750Ca";
module.exports.deployerPrivKey = "0x000000000000000000000000000000000000000000000000000000616c696365";

module.exports.relayerAddresses = [
    "0xff93B45308FD417dF303D6515aB04D9e89a750Ca", // Alice Public Address
    "0x8e0a907331554AF72563Bd8D43051C2E64Be5d35", // Bob Public Address
    "0x24962717f8fA5BA3b931bACaF9ac03924EB475a0", // Charlie Public Address
    "0x148FfB2074A9e59eD58142822b3eB3fcBffb0cd7", // Dave Public Address
    "0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485", // Eve Public Address
]

module.exports.relayerPrivKeys = [
    "0x000000000000000000000000000000000000000000000000000000616c696365", // Alice Private Key
    "0x0000000000000000000000000000000000000000000000000000000000626f62", // Bob Private Key
    "0x00000000000000000000000000000000000000000000000000636861726c6965", // Charlie Private Key
    "0x0000000000000000000000000000000000000000000000000000000064617665", // Dave Private Key
    "0x0000000000000000000000000000000000000000000000000000000000657665", // Eve Private Key
]


// These are deterministic
module.exports.BRIDGE_ADDRESS = "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF";
module.exports.RELAYER_ADDRESS = "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B";
module.exports.ERC20_ADDRESS = "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E";
module.exports.ERC20_HANDLER_ADDRESS = "0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07";
module.exports.ERC721_ADDRESS = "0x21605f71845f372A9ed84253d2D024B7B10999f4";
module.exports.ERC721_HANDLER_ADDRESS = "0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31";
module.exports.CENTRIFUGE_HANDLER = "0xc279648CE5cAa25B9bA753dAb0Dfef44A069BaF4";

module.exports.DEFAULT_SOURCE_ID = 0;
module.exports.DEFAULT_DEST_ID = 1;

module.exports.ERC20_RESOURCEID = ethers.utils.hexZeroPad((this.ERC20_ADDRESS + ethers.utils.hexlify(this.DEFAULT_SOURCE_ID).substr(2)), 32);
module.exports.ERC721_RESOURCEID = ethers.utils.hexZeroPad((this.ERC721_ADDRESS + ethers.utils.hexlify(this.DEFAULT_SOURCE_ID).substr(2)), 32);

