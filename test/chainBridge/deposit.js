const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');


const ERC20MintableContract = artifacts.require("ERC20Mintable");
const RelayerContract = artifacts.require('Relayer');
const BridgeContract = artifacts.require('Bridge');
const ERC20HandlerContract = artifacts.require('ERC20Handler');

contract('Bridge - [deposit]', async (accounts) => {
    const chainID = 0;
    const relayerThreshold = 0;
    const destinationChainID = 1;
    const initialTokenAmount = 100;
    const depositerAddress = accounts[1];
    const depositAmount = 10;
    const destinationRecipientAddress = accounts[2];
    const expectedDepositID = 1;
    
    let OriginOriginERC20MintableInstance;
    let DestinationERC20MintableInstance;
    let RelayerInstance;
    let BridgeInstance;
    let OriginERC20HandlerInstance;
    let DestinationERC20HandlerInstance;
    let depositData;

    beforeEach(async () => {
        OriginERC20MintableInstance = await ERC20MintableContract.new();
        DestinationERC20MintableInstance = await ERC20MintableContract.new();
        RelayerInstance = await RelayerContract.new([], relayerThreshold);
        BridgeInstance = await BridgeContract.new(chainID, RelayerInstance.address, relayerThreshold);
        OriginERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await OriginERC20MintableInstance.mint(depositerAddress, initialTokenAmount);
        await OriginERC20MintableInstance.approve(OriginERC20HandlerInstance.address, depositAmount, { from: depositerAddress });

        depositData = '0x' +
            Ethers.utils.hexZeroPad(OriginERC20MintableInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(destinationChainID), 32).substr(2) +
            Ethers.utils.hexZeroPad(DestinationERC20HandlerInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(DestinationERC20MintableInstance.address, 32).substr(2) +
            Ethers.utils.hexZeroPad(destinationRecipientAddress, 32).substr(2) +
            Ethers.utils.hexZeroPad(depositerAddress, 32).substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(depositAmount), 32).substr(2);
    });

    it('[sanity] depositerAddress should have a balance of initialTokenAmount', async () => {
        const depositerBalance = await OriginERC20MintableInstance.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), initialTokenAmount);
    });

    it("[sanity] OriginERC20HandlerInstance.address should have an allowance of depositAmount from depositerAddress", async () => {
        const handlerAllowance = await OriginERC20MintableInstance.allowance(depositerAddress, OriginERC20HandlerInstance.address);
        assert.strictEqual(handlerAllowance.toNumber(), depositAmount);
    });

    it('should make an ERC20 deposit successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            OriginERC20HandlerInstance.address, depositData));
    });

    it('deposit count for OriginERC20HandlerInstance.address should be incremented to expectedDepositID', async () => {
        await BridgeInstance.deposit(
            OriginERC20HandlerInstance.address, depositData);

        const depositCount = await BridgeInstance._depositCounts.call(
            OriginERC20HandlerInstance.address);
        assert.strictEqual(depositCount.toNumber(), expectedDepositID);
    });

    it('should create depositRecord with expected depositID and value', async () => {
        await BridgeInstance.deposit(
            OriginERC20HandlerInstance.address, depositData);

        const depositRecord = await BridgeInstance._depositRecords.call(
            OriginERC20HandlerInstance.address, expectedDepositID);
        assert.strictEqual(depositRecord, String(depositData).toLowerCase());
    });

    it('deposit should trigger deposit event with expected values', async () => {
        const depositTx = await BridgeInstance.deposit(
            OriginERC20HandlerInstance.address, depositData);

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.originChainHandlerAddress === OriginERC20HandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositID
        });
    });
});
