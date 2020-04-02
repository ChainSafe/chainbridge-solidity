const ethers = require('ethers');

const constants = require('../constants');
const CentrifugeHandlerContract = require("../../../build/contracts/CentrifugeAssetHandler.json");

async function getHash(cli) {
    const centHandler = new ethers.Contract(constants.CENTRIFUGE_HANDLER, CentrifugeHandlerContract.abi, cli.mainWallet);
    
    try {
        // const res = await centHandler.getHash(cli.hash);
        const res = await centHandler.getHash("0x736f796c656e745f677265656e5f69735f70656f706c65");
        console.log(`The hash ${cli.hash} was ${res ? "" : "NOT"} found!`);
    } catch (e) {
        console.log({ e });
    }
}

module.exports = {
    getHash,
}
