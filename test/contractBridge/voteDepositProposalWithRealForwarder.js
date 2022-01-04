/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const Wallet = require('ethereumjs-wallet').default;
const ethSigUtil = require('eth-sig-util');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ForwarderContract = artifacts.require("Forwarder");

contract('Bridge - [voteProposal through forwarder]', async (accounts) => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const relayer1 = Wallet.generate();
    const relayer2 = Wallet.generate();
    const relayer3 = Wallet.generate();
    const relayer4 = Wallet.generate();
    const relayer1Address = relayer1.getAddressString();
    const relayer2Address = relayer2.getAddressString();
    const relayer3Address = relayer3.getAddressString();
    const relayer4Address = relayer4.getAddressString();
    const relayer1Bit = 1 << 0;
    const relayer2Bit = 1 << 1;
    const relayer3Bit = 1 << 2;
    const depositer = Wallet.generate();
    const depositerAddress = depositer.getAddressString();
    const destinationChainRecipientAddress = accounts[4];
    const depositAmount = 10;
    const expectedDepositNonce = 1;
    const relayerThreshold = 3;
    const expectedFinalizedEventStatus = 2;

    const STATUS = {
        Inactive : '0',
        Active : '1',
        Passed : '2',
        Executed : '3',
        Cancelled : '4'
    }

    const name = 'Forwarder';
    const version = '0.0.1';

    const EIP712Domain = [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
    ];

    let domain;
    const types = {
        EIP712Domain,
        ForwardRequest: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'gas', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'data', type: 'bytes' },
        ],
    }

    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationERC20HandlerInstance;
    let ForwarderInstance;
    let depositData = '';
    let depositDataHash = '';
    let resourceID = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    let voteCallData, executeCallData;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(destinationDomainID, [
                relayer1Address,
                relayer2Address,
                relayer3Address,
                relayer4Address], 
                relayerThreshold, 
                0,
                100,).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);
        
        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originDomainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);
        ForwarderInstance = await ForwarderContract.new();

        await TruffleAssert.passes(BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, initialContractAddresses[0]));
        await TruffleAssert.passes(BridgeInstance.adminSetBurnable(DestinationERC20HandlerInstance.address, burnableContractAddresses[0]));

        depositData = Helpers.createERCDepositData(depositAmount, 20, destinationChainRecipientAddress);
        depositDataHash = Ethers.utils.keccak256(DestinationERC20HandlerInstance.address + depositData.substr(2));

        await Promise.all([
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationERC20HandlerInstance.address),
            BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address)
        ]);

        voteCallData = Helpers.createCallData(BridgeInstance, 'voteProposal', ["uint8", "uint64", "bytes32", "bytes"], [originDomainID, expectedDepositNonce, resourceID, depositData]);
        executeCallData = Helpers.createCallData(BridgeInstance, 'executeProposal', ["uint8", "uint64", "bytes", "bytes32", "bool"], [originDomainID, expectedDepositNonce, depositData, resourceID, true]);
        await BridgeInstance.adminSetForwarder(ForwarderInstance.address, true);

        const provider = new Ethers.providers.JsonRpcProvider();
        const signer = provider.getSigner();

        await signer.sendTransaction({to: relayer1Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: relayer2Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: relayer3Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: relayer4Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: depositerAddress, value: Ethers.utils.parseEther("0.1")});

        domain = {
            name,
            version,
            chainId: 1,
            verifyingContract: ForwarderInstance.address,
        };
    });

    it ('[sanity] bridge configured with threshold and relayers', async () => {
        assert.equal(await BridgeInstance._domainID(), destinationDomainID)

        assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

        assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')
    })

    it('[sanity] depositProposal should be created with expected values after the vote through forwarder', async () => {
        const request = {
            from: relayer1Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: voteCallData
        }

        const sign = ethSigUtil.signTypedMessage(
            relayer1.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request
                }
            }
        )

        await ForwarderInstance.execute(request, sign);
        const expectedDepositProposal = {
            _yesVotes: relayer1Bit.toString(),
            _yesVotesTotal: '1',
            _status: '1' // Active
        };

        const depositProposal = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);

        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it("depositProposal should be automatically executed after the vote if proposal status is changed to Passed during the vote", async () => {
        const request1 = {
            from: relayer1Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: voteCallData
        }
        const sign1 = ethSigUtil.signTypedMessage(
            relayer1.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request1
                }
            }
        )
        await ForwarderInstance.execute(request1, sign1);

        const request2 = {
            from: relayer2Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: voteCallData
        }
        const sign2 = ethSigUtil.signTypedMessage(
            relayer2.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request2
                }
            }
        )
        await ForwarderInstance.execute(request2, sign2);

        const request3 = {
            from: relayer3Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: voteCallData
        }
        const sign3 = ethSigUtil.signTypedMessage(
            relayer3.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request3
                }
            }
        )
        await ForwarderInstance.execute(request3, sign3); // After this vote, automatically executes the proposal.

        const depositProposalAfterThirdVoteWithExecute = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);

        assert.strictEqual(depositProposalAfterThirdVoteWithExecute._status, STATUS.Executed); // Executed
    });

    it('should not create proposal because depositerAddress is not a relayer', async () => {
        const request = {
            from: depositerAddress,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: voteCallData
        }
        const sign = ethSigUtil.signTypedMessage(
            depositer.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request
                }
            }
        )

        await ForwarderInstance.execute(request, sign);

        const expectedDepositProposal = {
            _yesVotes: '0',
            _yesVotesTotal: '0',
            _status: '0'
        };
        
        const depositProposal = await BridgeInstance.getProposal(
            originDomainID, expectedDepositNonce, depositDataHash);
        assert.deepInclude(Object.assign({}, depositProposal), expectedDepositProposal);
    });

    it("Relayer's address that used forwarder should be marked as voted for proposal", async () => {
        const relayer1_forwarder_nonce = await ForwarderInstance.getNonce(relayer1Address);
        const request1 = {
            from: relayer1Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: relayer1_forwarder_nonce,
            data: voteCallData
        }
        const sign1 = ethSigUtil.signTypedMessage(
            relayer1.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request1
                }
            }
        )
        await ForwarderInstance.execute(request1, sign1);

        const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
            Helpers.nonceAndId(expectedDepositNonce, originDomainID), depositDataHash, relayer1Address);
        assert.isTrue(hasVoted);
    });

    it('Execution successful', async () => {
        const relayer1_forwarder_nonce = await ForwarderInstance.getNonce(relayer1Address);
        const request1 = {
            from: relayer1Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: relayer1_forwarder_nonce,
            data: voteCallData
        }
        const sign1 = ethSigUtil.signTypedMessage(
            relayer1.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request1
                }
            }
        )
        await ForwarderInstance.execute(request1, sign1);

        const relayer2_forwarder_nonce = await ForwarderInstance.getNonce(relayer2Address);
        const request2 = {
            from: relayer2Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: relayer2_forwarder_nonce,
            data: voteCallData
        }
        const sign2 = ethSigUtil.signTypedMessage(
            relayer2.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request2
                }
            }
        )
        await ForwarderInstance.execute(request2, sign2);

        const relayer3_forwarder_nonce = await ForwarderInstance.getNonce(relayer3Address);
        const request3 = {
            from: relayer3Address,
            to: BridgeInstance.address,
            value: '0',
            gas: '300000',
            nonce: relayer3_forwarder_nonce,
            data: voteCallData
        }
        const sign3 = ethSigUtil.signTypedMessage(
            relayer3.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request3
                }
            }
        )

        const voteWithExecuteTx_Forwarder = await ForwarderInstance.execute(request3, sign3);
        const voteWithExecuteTx_Bridge = await TruffleAssert.createTransactionResult(BridgeInstance, voteWithExecuteTx_Forwarder.tx);

        TruffleAssert.eventEmitted(voteWithExecuteTx_Bridge, 'ProposalEvent', (event) => {
            return event.originDomainID.toNumber() === originDomainID &&
                event.depositNonce.toNumber() === expectedDepositNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === depositDataHash
        });
    });
});
