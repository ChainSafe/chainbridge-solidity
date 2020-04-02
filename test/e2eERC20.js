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
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;

    let RelayerInstance;
    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let tokenID;
    let depositData;
    let depositProposalData;
    let depositProposalDataHash;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([relayer1Address, relayer2Address], relayerThreshold);
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        ERC20MintableInstance = await ERC20MintableContract.new();
        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await ERC20MintableInstance.mint(depositerAddress, initialTokenAmount);
        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress });

        await ERC20MintableInstance.addMinter(ERC20HandlerInstance.address);

        tokenID = Ethers.utils.hexZeroPad(Ethers.utils.hexlify(chainID), 32).substr(2) + 
                  Ethers.utils.hexZeroPad(Ethers.utils.hexlify(ERC20MintableInstance.address), 32).substr(2);

        depositData = '0x' +
            Ethers.utils.hexZeroPad(ERC20MintableInstance.address, 32).substr(2) +
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
        const depositerBalance = await ERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });

    it("[sanity] ERC20HandlerInstance.address should have an allowance of depositAmount from depositerAddress", async () => {
        const handlerAllowance = await ERC20MintableInstance.allowance(depositerAddress, ERC20HandlerInstance.address);
        assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
    });

    it("depositAmount of Destination ERC20 should be minted for recipientAddress", async () => {
        // depositerAddress makes initial deposit of depositAmount
        TruffleAssert.passes(await BridgeInstance.deposit(
            chainID,
            ERC20HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));

        // Handler should have a balance of depositAmount
        const handlerBalance = await ERC20MintableInstance.balanceOf(ERC20HandlerInstance.address);
        assert.strictEqual(handlerBalance.toNumber(), depositAmount);

        // relayer1 creates the deposit proposal
        TruffleAssert.passes(await BridgeInstance.voteDepositProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the deposit proposal
        // because the relayerThreshold is 2, the deposit proposal will go
        // into a finalized state
        TruffleAssert.passes(await BridgeInstance.voteDepositProposal(
            chainID,
            expectedDepositNonce,
            depositProposalDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await BridgeInstance.executeDepositProposal(
            chainID,
            expectedDepositNonce,
            ERC20HandlerInstance.address,
            depositProposalData
        ));

        // Assert ERC20 balance was transferred from depositerAddress
        const depositerBalance = await ERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount - depositAmount);

        // // Assert ERC20 balance was transferred to recipientAddress
        const recipientBalance = await ERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientBalance.toNumber(), depositAmount);
    });
});
