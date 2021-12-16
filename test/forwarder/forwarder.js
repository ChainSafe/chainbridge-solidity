/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const Ethers = require('ethers');
const Wallet = require('ethereumjs-wallet').default;
const ethSigUtil = require('eth-sig-util');
const ForwarderContract = artifacts.require("Forwarder");

contract('Forwarder', async (accounts) => {
    const relayer1 = Wallet.generate();
    const relayer2 = Wallet.generate();
    const relayer1Address = relayer1.getAddressString();
    const relayer2Address = relayer2.getAddressString();
    const BridgeAddress = accounts[0];

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

    let ForwarderInstance;

    let sign;
    let request;

    beforeEach(async () => {
        ForwarderInstance = await ForwarderContract.new();

        const provider = new Ethers.providers.JsonRpcProvider();
        const signer = provider.getSigner();

        await signer.sendTransaction({to: relayer1Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: relayer2Address, value: Ethers.utils.parseEther("0.1")});

        domain = {
            name,
            version,
            chainId: 1,
            verifyingContract: ForwarderInstance.address,
        };

        request = {
            from: relayer1Address,
            to: BridgeAddress,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        sign = ethSigUtil.signTypedMessage(
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
    });

    it ('In case of invalid request(from) is not different from signer, it should not be verified in the forwarder contract', async () => {
        const request_other = {
            from: relayer2Address,
            to: BridgeAddress,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
    });

    it ('In case of invalid request(to) is not different from signature, it should not be verified in the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: relayer2Address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
    });

    it ('In case of invalid request(value) is not different from signature, it should not be verified in the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: BridgeAddress,
            value: '1',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
    });

    it ('In case of invalid request(gas) is not different from signature, it should not be verified in the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: BridgeAddress,
            value: '0',
            gas: '50000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
    });

    it ('In case of invalid request(nonce) is not different from signature, it should not be verified in the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: BridgeAddress,
            value: '0',
            gas: '300000',
            nonce: 1,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
    });

    it ('In case of invalid request(data) is not different from signature, it should not be verified in the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: BridgeAddress,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x1234'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
    });

    it ('In case of request is matched with signature, it should be verified in the forwarder contract', async () => {
        assert.equal((await ForwarderInstance.verify(request, sign)), true);
    });

    it ('In case of request is matched with signature, it should not be reverted and nonce should be increased', async () => {
        const nonce_before_execute = await ForwarderInstance.getNonce(relayer1Address);
        await ForwarderInstance.execute(request, sign);
        const nonce_after_execute = await ForwarderInstance.getNonce(relayer1Address);
        assert.equal(nonce_after_execute.toNumber(), nonce_before_execute.toNumber() + 1);
    });
});
