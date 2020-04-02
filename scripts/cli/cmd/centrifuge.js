const ethers = require('ethers');

const constants = require('../constants');
const CentrifugeHandlerContract = require("../../../build/contracts/CentrifugeAssetHandler.json");
const BridgeContract = require("../../../build/contracts/Bridge.json");

async function getHash(cli) {
    const centHandler = new ethers.Contract(cli.centAddress, CentrifugeHandlerContract.abi, cli.mainWallet);
    
    try {
        const res = await centHandler.getHash(ethers.utils.hexZeroPad(cli.hash, 32));
        console.log(`The hash ${cli.hash} was ${res ? "" : "NOT"} found!`);
    } catch (e) {
        console.log({ e });
    }
}

async function submitCentHash(cli) {
    const bridgeInstance = new ethers.Contract(constants.BRIDGE_ADDRESS, BridgeContract.abi, cli.mainWallet);
    
    const nonce = (await bridgeInstance._totalProposals()).toNumber() + 1;
    console.log("Nonce: ", nonce)
    
    const hash = ethers.utils.hexZeroPad(cli.hash, 32)
    const keccakHash = ethers.utils.keccak256(hash);

    try {
        let tx = await bridgeInstance.voteDepositProposal(
            cli.originChain,
            nonce,
            keccakHash
        )
        console.log(`Proposal created, hash: ${tx.hash}`);

        tx = await bridgeInstance.executeDepositProposal(
            cli.originChain,
            nonce,
            cli.centAddress,
            hash
        )
        console.log(`Proposal executed, hash: ${tx.hash}`);

    } catch (e) {
        console.log({e});
    }
}

module.exports = {
    getHash,
    submitCentHash,
}
