const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const RelayerContract = artifacts.require("Relayer");
const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20Mintable");
const ERC20HandlerContract = artifacts.require("ERC20Handler");

contract('E2E ERC20 - Same Chain', async accounts => {
    // const AbiCoder = new Ethers.utils.AbiCoder();

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

    let resourceID;
    let depositData;
    let depositProposalData;
    let depositProposalDataHash;
    let initialResourceIDs;
    let initialContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            RelayerContract.new([relayer1Address, relayer2Address], relayerThreshold).then(instance => RelayerInstance = instance),
            ERC20MintableContract.new().then(instance => ERC20MintableInstance = instance)
        ]);

        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);

        resourceID = Ethers.utils.hexZeroPad((ERC20MintableInstance.address + Ethers.utils.hexlify(chainID).substr(2)), 32)
    
        initialResourceIDs = [resourceID];
        initialContractAddresses = [ERC20MintableInstance.address];

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, false);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, initialTokenAmount),
            ERC20MintableInstance.addMinter(ERC20HandlerInstance.address)
        ]);
        
        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, depositAmount, { from: depositerAddress });


        depositData = '0x' +
            Ethers.utils.hexZeroPad(ERC20MintableInstance.address, 32).substr(2) +          // OriginHandlerAddress  (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +    // Deposit Amount        (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +               // len(recipientAddress) (32 bytes)
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2);                        // recipientAddress      (?? bytes)


        depositProposalData = '0x' +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2) +    // Deposit Amount        (32 bytes) 
            resourceID.substr(2) +                                                          // resourceID            (32 bytes) for now
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(20), 32).substr(2) +               // len(recipientAddress) (32 bytes)
            Ethers.utils.hexlify(recipientAddress).substr(2);                               // recipientAddress      (?? bytes)

            
        depositProposalDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositProposalData.substr(2));
    });

    it("[sanity] depositerAddress' balance should be equal to initialTokenAmount", async () => {
        const depositerBalance = await ERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });

    it("[sanity] ERC20HandlerInstance.address should have an allowance of depositAmount from depositerAddress", async () => {
        const handlerAllowance = await ERC20MintableInstance.allowance(depositerAddress, ERC20HandlerInstance.address);
        assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
    });

    it("depositAmount of Destination ERC20 should be transferred to recipientAddress", async () => {
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
