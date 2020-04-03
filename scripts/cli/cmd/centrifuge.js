const ethers = require('ethers');

const constants = require('../constants');
const CentrifugeHandlerContract = require("../../../build/contracts/CentrifugeAssetHandler.json");
const BridgeContract = require("../../../build/contracts/Bridge.json");

async function getHash(cli) {
    const centHandler = new ethers.Contract(cli.centAddress, CentrifugeHandlerContract.abi, cli.mainWallet);
    
    try {
        const res = await centHandler.getHash(ethers.utils.hexZeroPad(cli.hash, 32));
        console.log(`The hash ${cli.hash} was ${res ? "found!" : "NOT found!"}`);
    } catch (e) {
        console.log({ e });
        process.exit(1)
    }
}

async function submitCentHash(cli) {
    const bridgeInstance = new ethers.Contract(constants.BRIDGE_ADDRESS, BridgeContract.abi, cli.mainWallet);
    
    // MainWallet is already a voter, thus reduce by 1
    const threshold = (await bridgeInstance._relayerThreshold()).toNumber() - 1;
    
    const relayers = [];
    // start at index 1 because mainwWallet is index 0 of relayerPrivKeys
    for (let i=0;i < threshold; i++) {
        relayers.push(constants.relayerPrivKeys[i + 1]);
    }
    
    const nonce = (await bridgeInstance._totalDepositProposals()).toNumber() + 1;
    console.log("Nonce: ", nonce)
    
    const hash = ethers.utils.hexZeroPad(cli.hash, 32)
    const keccakHash = ethers.utils.keccak256(cli.centAddress + hash.substr(2));

    try {
        let tx = await bridgeInstance.voteDepositProposal(
            cli.originChain,
            nonce,
            keccakHash
        )
        console.log(`Proposal created, hash: ${tx.hash}`);
        // Make sure to pass the threshold
        for( let i=0; i < relayers.length; i++){
            const wallet = new ethers.Wallet(relayers[i], cli.mainWallet.provider);
            const bridgeInstance = new ethers.Contract(constants.BRIDGE_ADDRESS, BridgeContract.abi, wallet);
            let tx = await bridgeInstance.voteDepositProposal(
                cli.originChain,
                nonce,
                keccakHash
            )
            console.log(`Vote casted, hash: ${tx.hash}`);
        }

        tx = await bridgeInstance.executeDepositProposal(
            cli.originChain,
            nonce,
            cli.centAddress,
            hash
        )
        console.log(`Proposal executed, hash: ${tx.hash}`);
    } catch (e) {
        console.log({e});
        process.exit(1)
    }
}

module.exports = {
    getHash,
    submitCentHash,
}
