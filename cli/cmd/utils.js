const ethers = require('ethers');
const fs = require('fs');

const setupParentArgs = async (args, parent) => {
    args.url= parent.url
    args.provider = new ethers.providers.JsonRpcProvider(args.url);
    args.gasLimit = ethers.utils.hexlify(Number(parent.gasLimit))
    args.gasPrice = ethers.utils.hexlify(Number(parent.gasPrice))
    if (!parent.jsonWallet) {
        args.wallet = new ethers.Wallet(parent.privateKey, args.provider);
    } else {
        const raw = fs.readFileSync(parent.jsonWallet);
        const keyfile = JSON.parse(raw);
        args.wallet = await ethers.Wallet.fromEncryptedJson(keyfile, parent.jsonWalletPassword)
    }
}

const splitCommaList = (str) => {
    return str.split(",")
}

const getFunctionBytes = (sig) => {
    return ethers.utils.keccak256(ethers.utils.hexlify(ethers.utils.toUtf8Bytes(sig))).substr(0, 10)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const waitForTx = async (provider, hash) => {
    console.log(`Waiting for tx. Hash: ${hash}`)
    while (!await provider.getTransactionReceipt(hash)) {
        sleep(5000)
    }
}

module.exports = {
    setupParentArgs,
    splitCommaList,
    getFunctionBytes,
    waitForTx
}