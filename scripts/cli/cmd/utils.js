const ethers = require('ethers');

const setupParentArgs = (args, parent) => {
    args.url= parent.url
    args.provider = new ethers.providers.JsonRpcProvider(args.url);
    args.wallet = new ethers.Wallet(parent.privateKey, args.provider);
}

const splitCommaList = (str) => {
    return str.split(",")
}

module.exports = {
    setupParentArgs,
    splitCommaList
}