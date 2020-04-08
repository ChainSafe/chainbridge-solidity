const ethers = require('ethers');

const setupParentArgs = (args, parent) => {
    args.url = `http://${parent.host || "localhost"}:${parent.port}`;
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