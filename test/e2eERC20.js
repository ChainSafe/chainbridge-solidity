const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20Mintable");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('E2E ERC20 - Same Chain', async accounts => {
    const relayerThreshold = 2;
    const chainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const originRelayer1Address = accounts[3];
    const originRelayer2Address = accounts[4];

    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;

    let OriginRelayerInstance;
    let OriginBridgeInstance;
    let OriginERC20MintableInstance;
    let OriginERC20HandlerInstance;

    // let DestinationRelayerInstance;
    // let DestinationBridgeInstance;
    // let DestinationERC20MintableInstance;
    // let DestinationERC20HandlerInstance;

    let tokenID;
    let depositData;
    let depositProposalData;
    let depositProposalDataHash;

    beforeEach(async () => {
        OriginRelayerInstance = await RelayerContract.new([originRelayer1Address, originRelayer2Address], relayerThreshold);
        OriginBridgeInstance = await BridgeContract.new(chainID, OriginRelayerInstance.address, relayerThreshold);
        OriginERC20MintableInstance = await ERC20MintableContract.new();
        OriginERC20HandlerInstance = await ERC20HandlerContract.new(OriginBridgeInstance.address);

        // DestinationRelayerInstance = await RelayerContract.new([], relayerThreshold);
        // DestinationBridgeInstance = await BridgeContract.new(chainID, DestinationRelayerInstance.address, relayerThreshold);
        // DestinationERC20MintableInstance = await ERC20MintableContract.new();
        // DestinationERC20HandlerInstance = await ERC20HandlerContract.new(DestinationBridgeInstance.address);

        await OriginERC20MintableInstance.mint(depositerAddress, initialTokenAmount);
        await OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount, { from: depositerAddress });

        await OriginERC20MintableInstance.addMinter(OriginERC20HandlerInstance.address);

        tokenID = Ethers.utils.hexZeroPad(Ethers.utils.hexlify(chainID), 32).substr(2) + 
                  Ethers.utils.hexZeroPad(Ethers.utils.hexlify(OriginERC20MintableInstance.address), 32).substr(2);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(OriginERC20MintableInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // length of next arg in bytes
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2);

        depositProposalData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(64), 32).substr(2) + // length of next arg in bytes
            tokenID +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) + // length of next arg in bytes
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(recipientAddress), 32).substr(2);
        
        depositProposalDataHash = Ethers.utils.keccak256(depositProposalData);
    });

    it("[sanity] depositerAddress' balance should be equal to initialTokenAmount", async () => {
        const depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });

    it("[sanity] OriginERC20HandlerInstance.address should have an allowance of depositAmount from depositerAddress", async () => {
        const originChainHandlerAllowance = await OriginERC20MintableInstance.allowance(depositerAddress, OriginERC20HandlerInstance.address);
        assert.strictEqual(originChainHandlerAllowance.toNumber(), depositAmount);
    });

    it("depositAmount of Destination ERC20 should be minted for recipientAddress", async () => {
        // depositerAddress makes initial deposit of depositAmount
        TruffleAssert.passes(await OriginBridgeInstance.deposit(
            chainID,
            OriginERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));

        // destinationRelayer1 create the deposit proposal on the destination Bridge
        TruffleAssert.passes(await OriginBridgeInstance.voteDepositProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: originRelayer1Address }
        ));

        // destinationRelayer2 votes in favor of the deposit proposal
        // because the relayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await OriginBridgeInstance.voteDepositProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: originRelayer2Address }
        ));

        // destinationRelayer1 will execute the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.executeDepositProposal(
            chainID,
            expectedDepositNonce,
            OriginERC20HandlerInstance.address,
            depositProposalData
        ));

        const gotTokenID = await OriginERC20HandlerInstance._tokenContractAddressToTokenID.call(OriginERC20MintableInstance.address);
        console.log(gotTokenID);

        const gotAddress = await OriginERC20HandlerInstance._tokenIDToTokenContractAddress.call(`0x${tokenID}`);
        console.log(gotAddress);

        console.log('recipientAddress', recipientAddress);

        // Assert Origin ERC20 balance was transferred from depositerAddress
        const depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount - depositAmount);

        // Assert Destination ERC20 balance was transferred to recipientAddress
        const recipientBalance = await OriginERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientBalance.toNumber(), depositAmount);
    });
});
