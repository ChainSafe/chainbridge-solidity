const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');
const { convertCompilerOptionsFromJson } = require('typescript');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("HandlerRevert");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");
const ERC1155MintableContract = artifacts.require("ERC1155PresetMinterPauser");
const ERC1155HandlerContract = artifacts.require("HandlerRevert");
const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract('Bridge - [execute - FailedHandlerExecution]', async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const adminAddress = accounts[0]
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];

    const tokenID = 1;
    const erc721DepositMetadata = "0xf00d";
    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonces = [1, 2, 3];
    const feeData = '0x';

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;
    let ERC721MintableInstance;
    let ERC721HandlerInstance;
    let ERC1155MintableInstance;
    let ERC1155HandlerInstance;
    let CentrifugeAssetInstance;

    let GenericHandlerInstance;

    let initialGenericContractAddress;
    let initialGenericDepositFunctionSignature;
    let initialGenericDepositFunctionDepositerOffset;
    let initialGenericExecuteFunctionSignature;

    let erc20ResourceID;
    let erc721ResourceID;
    let erc1155ResourceID;
    let erc20DepositData;
    let erc20DepositProposalData;
    let erc721DepositData;
    let erc721DepositProposalData;
    let erc1155DepositData;
    let erc1155DepositProposalData;
    let genericProposalData;
    let genericDepositProposalDataHash;

    let proposalsForExecution;

    beforeEach(async () => {
        await Promise.all([
            BridgeInstance = await Helpers.deployBridge(destinationDomainID, adminAddress),
            ERC20MintableContract.new("token721", "TOK20").then(instance => ERC20MintableInstance = instance),
            ERC721MintableContract.new("token20", "TOK721", "").then(instance => ERC721MintableInstance = instance),
            ERC1155MintableContract.new("TOK1155").then(instance => ERC1155MintableInstance = instance),
            CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance)
        ]);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        ERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address);
        ERC1155HandlerInstance = await ERC1155HandlerContract.new(BridgeInstance.address);
        GenericHandlerInstance = await GenericHandlerContract.new(BridgeInstance.address);

        erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);
        erc721ResourceID = Helpers.createResourceID(ERC721MintableInstance.address, originDomainID);
        erc1155ResourceID = Helpers.createResourceID(ERC1155MintableInstance.address, originDomainID);
        genericResourceID = Helpers.createResourceID(GenericHandlerInstance.address, originDomainID);

        initialGenericContractAddress = ERC20MintableInstance.address;
        initialGenericDepositFunctionSignature = Helpers.blankFunctionSig;
        initialGenericDepositFunctionDepositerOffset = Helpers.blankFunctionDepositerOffset;
        initialGenericExecuteFunctionSignature = Helpers.getFunctionSignature(ERC20MintableContract, 'mint');;

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, initialTokenAmount),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
            ERC721MintableInstance.grantRole(await ERC721MintableInstance.MINTER_ROLE(), ERC721HandlerInstance.address),
            ERC721MintableInstance.mint(depositerAddress, tokenID, erc721DepositMetadata),
            BridgeInstance.adminSetResource(ERC721HandlerInstance.address, erc721ResourceID, ERC721MintableInstance.address),
            ERC1155MintableInstance.mintBatch(depositerAddress, [tokenID], [initialTokenAmount], "0x0"),
            BridgeInstance.adminSetResource(ERC1155HandlerInstance.address, erc1155ResourceID, ERC1155MintableInstance.address),
            BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, genericResourceID, initialGenericContractAddress, initialGenericDepositFunctionSignature, initialGenericDepositFunctionDepositerOffset, initialGenericExecuteFunctionSignature)
        ]);

        await Promise.all([
            ERC20MintableInstance.approve(ERC20HandlerInstance.address, 5000, { from: depositerAddress }),
            ERC721MintableInstance.approve(ERC721HandlerInstance.address, tokenID, { from: depositerAddress }),
            ERC1155MintableInstance.setApprovalForAll(ERC1155HandlerInstance.address, true, { from: depositerAddress })
        ]);

        erc20DepositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        erc20DepositProposalData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        erc20DepositProposalDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + erc20DepositProposalData.substr(2));

        erc721DepositData = Helpers.createERCDepositData(tokenID, 20, recipientAddress);
        erc721DepositProposalData = Helpers.createERC721DepositProposalData(tokenID, 20, recipientAddress, erc721DepositMetadata.length, erc721DepositMetadata);
        erc721DepositProposalDataHash = Ethers.utils.keccak256(ERC721HandlerInstance.address + erc721DepositProposalData.substr(2));

        erc1155DepositData = Helpers.createERC1155DepositData([tokenID], [depositAmount]);
        erc1155DepositProposalData = Helpers.createERC1155DepositProposalData([tokenID], [depositAmount], recipientAddress, "0x");

        genericProposalData = Helpers.createGenericDepositData(null);
        genericDepositProposalDataHash = Ethers.utils.keccak256(GenericHandlerInstance.address + genericProposalData.substr(2));

        proposalsForExecution = [{
          originDomainID: originDomainID,
          depositNonce: expectedDepositNonces[0],
          resourceID: erc20ResourceID,
          data: erc20DepositProposalData
        },
        {
          originDomainID: originDomainID,
          depositNonce: expectedDepositNonces[1],
          resourceID: erc721ResourceID,
          data: erc721DepositProposalData
        },
        {
          originDomainID: originDomainID,
          depositNonce: expectedDepositNonces[2],
          resourceID: genericResourceID,
          data: genericProposalData
        }];

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("[executeProposal - ERC20] - Should revert if handler execute is reverted", async () => {
        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signDataWithMpc(
          originDomainID, destinationDomainID, expectedDepositNonces[0], erc20DepositProposalData, erc20ResourceID
        );

        await TruffleAssert.reverts(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonces[0],
            erc20DepositProposalData,
            erc20ResourceID,
            proposalSignedData,
            { from: relayer1Address }
        ));

        const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
          originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalAfterFailedExecute);
    });

    it("[executeProposal - ERC721] - Should revert if handler execute is reverted", async () => {
        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signDataWithMpc(
          originDomainID, destinationDomainID, expectedDepositNonces[0], erc721DepositProposalData, erc721ResourceID
        );

        await TruffleAssert.reverts(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonces[0],
            erc721DepositProposalData,
            erc721ResourceID,
            proposalSignedData,
            { from: relayer1Address }
        ));

        const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalAfterFailedExecute);
    });

    it("[executeProposal - ERC1155] - Should revert if handler execute is reverted", async () => {
        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signDataWithMpc(
          originDomainID, destinationDomainID, expectedDepositNonces[0], erc1155DepositProposalData, erc1155ResourceID
        );

        await TruffleAssert.reverts(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonces[0],
            erc1155DepositProposalData,
            erc1155ResourceID,
            proposalSignedData,
            { from: relayer1Address }
        ));

        const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalAfterFailedExecute);
    });

    it("[executeProposal - Generic] - Should not revert if handler execution failed. FailedHandlerExecution event should be emitted", async () => {
        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
          originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signDataWithMpc(originDomainID, destinationDomainID, expectedDepositNonces[0], genericProposalData, genericResourceID);

        const executeTx = await BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonces[0],
            genericProposalData,
            genericResourceID,
            proposalSignedData,
            { from: relayer1Address }
        );

        // check that "FailedHandlerExecution" event was emitted on the handler
        const handlerPastEvents = await GenericHandlerInstance.getPastEvents('FailedHandlerExecution')
        assert(handlerPastEvents[0].event === 'FailedHandlerExecution');

        TruffleAssert.eventEmitted(executeTx, 'ProposalExecution', (event) => {
            return event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonces[0] &&
                event.dataHash === genericDepositProposalDataHash
        });

        const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
          originDomainID, expectedDepositNonces[0]);

        // depositNonce is used
        assert.isTrue(depositProposalAfterFailedExecute);
    });

    it("[executeProposals] - Should not revert if handler execute is reverted and continue to process next execution. FailedHandlerExecution event should be emitted with expected values.", async () => {
        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonces[0]);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signArrayOfDataWithMpc(proposalsForExecution, destinationDomainID);

        // depositerAddress makes initial deposit of depositAmount
        await TruffleAssert.passes(BridgeInstance.deposit(
            originDomainID,
            erc721ResourceID,
            erc721DepositData,
            feeData,
            { from: depositerAddress }
        ));

        // check that all nonces in nonce set are 0
        const noncesSetBeforeDeposit = await BridgeInstance.usedNonces(originDomainID, 0);
        assert.equal(
          Helpers.decimalToPaddedBinary(noncesSetBeforeDeposit.toNumber()),
          // nonces:                                             ...6543210
          "0000000000000000000000000000000000000000000000000000000000000000"
        );

        const executeTx = await BridgeInstance.executeProposals(
            proposalsForExecution,
            proposalSignedData,
            { from: relayer1Address }
        );

        TruffleAssert.eventEmitted(executeTx, 'FailedHandlerExecution', (event) => {
          return event.originDomainID.toNumber() === originDomainID &&
              event.depositNonce.toNumber() === expectedDepositNonces[0] &&
              Ethers.utils.parseBytes32String('0x' + event.lowLevelData.slice(-64)) === 'Something bad happened'
        });

        const erc20depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
          originDomainID, expectedDepositNonces[0]
        );
        // depositNonce for failed ERC20 deposit is unset
        assert.isFalse(erc20depositProposalAfterFailedExecute);

        const erc721depositProposal = await BridgeInstance.isProposalExecuted(
          originDomainID, expectedDepositNonces[1]
        );
        // depositNonce for ERC721 deposit is used
        assert.isTrue(erc721depositProposal);

        const genericDepositProposal = await BridgeInstance.isProposalExecuted(
          originDomainID, expectedDepositNonces[2]
        );
        // depositNonce for generic deposit is used
        assert.isTrue(genericDepositProposal);


        // recipient ERC20 token balances hasn't changed
        const recipientERC20Balance = await ERC20MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC20Balance.toNumber(), 0);

        // recipient ERC721 token balance has changed to 1 token
        const recipientERC721Balance = await ERC721MintableInstance.balanceOf(recipientAddress);
        assert.strictEqual(recipientERC721Balance.toNumber(), 1);

        // check that other nonces in nonce set are not affected after failed deposit
        const noncesSetAfterDeposit = await BridgeInstance.usedNonces(originDomainID, 0);
        assert.equal(
          Helpers.decimalToPaddedBinary(noncesSetAfterDeposit.toNumber()),
          // nonces:                                             ...6543210
          "0000000000000000000000000000000000000000000000000000000000001100"
        );

        // check that 'ProposalExecution' event has been emitted with proper values for ERC721 deposit
        assert.equal(executeTx.logs[1].args.originDomainID, 1);
        assert.equal(executeTx.logs[1].args.depositNonce, expectedDepositNonces[1]);
        assert.equal(executeTx.logs[1].args.dataHash, erc721DepositProposalDataHash);

        // check that 'ProposalExecution' event has been emitted with proper values for generic deposit
        assert.equal(executeTx.logs[2].args.originDomainID, 1);
        assert.equal(executeTx.logs[2].args.depositNonce, expectedDepositNonces[2]);
        assert.equal(executeTx.logs[2].args.dataHash, genericDepositProposalDataHash);
    });
});
