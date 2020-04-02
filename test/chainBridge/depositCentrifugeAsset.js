const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');


const RelayerContract = artifacts.require('Relayer');
const BridgeContract = artifacts.require('Bridge');
const CentrifugeAssetHandlerContract = artifacts.require('CentrifugeAssetHandler');

contract('Bridge - [deposit - centrifugeAsset]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const relayerThreshold = 1;
    const relayer = accounts[0];
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const expectedDepositID = 1;
    const genericBytes = '0x736f796c656e745f677265656e5f69735f70656f706c65';
    
    let RelayerInstance;
    let BridgeInstance;
    let CentrifugeAssetHandlerInstance;
    let depositData;

    beforeEach(async () => {
        RelayerInstance = await RelayerContract.new([relayer], relayerThreshold);
        BridgeInstance = await BridgeContract.new(originChainID, RelayerInstance.address, relayerThreshold);
        CentrifugeAssetHandlerInstance = await CentrifugeAssetHandlerContract.new(BridgeInstance.address);

        depositData = '0x' +
            Ethers.utils.hexZeroPad('0x0', 32).substr(2) +
            Ethers.utils.hexZeroPad('0x0', 32).substr(2) +
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2) +
            Ethers.utils.keccak256(genericBytes).substr(2);
    });

    it('should make a CentrifugeAsset deposit successfully', async () => {
        TruffleAssert.passes(await BridgeInstance.deposit(
            destinationChainID,
            CentrifugeAssetHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        ));
    });

    it('deposit count for CentrifugeAssetHandlerInstance.address should be incremented to expectedDepositID', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            CentrifugeAssetHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositID);
    });

    it('should create depositRecord with expected depositID and value', async () => {
        await BridgeInstance.deposit(
            destinationChainID,
            CentrifugeAssetHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const depositRecord = await BridgeInstance._depositRecords.call(destinationChainID, expectedDepositID);
        assert.strictEqual(depositRecord, String(depositData).toLowerCase());
    });

    it('deposit should trigger deposit event with expected values', async () => {
        const depositTx = await BridgeInstance.deposit(
            destinationChainID,
            CentrifugeAssetHandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        TruffleAssert.eventEmitted(depositTx, 'Deposit', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.destinationChainID.toNumber() === destinationChainID &&
                event.originChainHandlerAddress === CentrifugeAssetHandlerInstance.address &&
                event.depositNonce.toNumber() === expectedDepositID
        });
    });

    it('can query correct value', async () => {
        await BridgeInstance.voteDepositProposal(
            destinationChainID,
            expectedDepositID,
            Ethers.utils.keccak256(genericBytes),
            { from: relayer }
        )
        await BridgeInstance.executeDepositProposal(
            destinationChainID,
            expectedDepositID,
            CentrifugeAssetHandlerInstance.address,
            genericBytes
        )

        const res = await CentrifugeAssetHandlerInstance.getHash(genericBytes);
        assert.strictEqual(res, true);
    })
});