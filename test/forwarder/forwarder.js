/**
 * Copyright 2021 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const Wallet = require('ethereumjs-wallet').default;
const ethSigUtil = require('eth-sig-util');
const ForwarderContract = artifacts.require("Forwarder");
const TestTargetContract = artifacts.require("TestTarget");

contract('Forwarder', async (accounts) => {
    const relayer1 = Wallet.generate();
    const relayer2 = Wallet.generate();
    const relayer3 = Wallet.generate();
    const relayer1Address = relayer1.getAddressString();
    const relayer2Address = relayer2.getAddressString();
    const relayer3Address = relayer3.getAddressString();

    const provider = new Ethers.providers.JsonRpcProvider();

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
    let TestTargetInstance;

    let sign;
    let request;

    beforeEach(async () => {
        ForwarderInstance = await ForwarderContract.new();
        TestTargetInstance = await TestTargetContract.new();
        
        const signer = provider.getSigner();

        await signer.sendTransaction({to: relayer1Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: relayer2Address, value: Ethers.utils.parseEther("0.1")});
        await signer.sendTransaction({to: relayer3Address, value: Ethers.utils.parseEther("0.1")});

        domain = {
            name,
            version,
            chainId: 1,
            verifyingContract: ForwarderInstance.address,
        };

        request = {
            from: relayer1Address,
            to: TestTargetInstance.address,
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

    it ('In case of invalid request(from), it should not be verified and should be reverted in executing of the forwarder contract', async () => {
        const request_other = {
            from: relayer2Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign), "MinimalForwarder: signature does not match request");
    });

    it ('In case of invalid request(to), it should not be verified and should be reverted in executing of the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: relayer2Address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign), "MinimalForwarder: signature does not match request");
    });

    it ('In case of invalid request(value), it should not be verified and should be reverted in executing of the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: TestTargetInstance.address,
            value: '1',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign), "MinimalForwarder: signature does not match request");
    });

    it ('In case of invalid request(gas), it should not be verified and should be reverted in executing of the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '50000',
            nonce: 0,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign), "MinimalForwarder: signature does not match request");
    });

    it ('In case of invalid request(nonce), it should not be verified and should be reverted in executing of the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '300000',
            nonce: 1,
            data: '0x'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign), "MinimalForwarder: signature does not match request");
    });

    it ('In case of invalid request(data), it should not be verified and should be reverted in executing of the forwarder contract', async () => {
        const request_other =  {
            from: relayer1Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x1234'
        }

        assert.equal((await ForwarderInstance.verify(request_other, sign)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign), "MinimalForwarder: signature does not match request");
    });

    it ('If signature is valid, but req.from != signer, it should be reverted and should not be verified', async () => {
        const sign_other = ethSigUtil.signTypedMessage(
            relayer2.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request
                }
            }
        )

        assert.equal((await ForwarderInstance.verify(request, sign_other)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request, sign_other), "MinimalForwarder: signature does not match request");
    });

    it ('If signature is valid, but req.nonce != nonce[signer], it should be reverted and should not be verified', async () => {
        const request_other =  {
            from: relayer1Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '300000',
            nonce: 10,
            data: '0x'
        }

        const sign_other = ethSigUtil.signTypedMessage(
            relayer1.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: request_other
                }
            }
        )

        assert.equal((await ForwarderInstance.verify(request_other, sign_other)), false);
        return TruffleAssert.reverts(ForwarderInstance.execute(request_other, sign_other), "MinimalForwarder: signature does not match request");
    });

    it ('Execute should succeed even if the call to the target failed', async () => {
        const new_request = {
            from: relayer1Address,
            to: ForwarderInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        const new_sign = ethSigUtil.signTypedMessage(
            relayer1.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: new_request
                }
            }
        )

        const result = await ForwarderInstance.execute.call(new_request, new_sign);
        assert.equal(result[0], false);
    });

    it ('Should be failed in case of execute is called with less gas than req.gas', async () => {
        const new_request = {
            from: relayer3Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        const new_sign = ethSigUtil.signTypedMessage(
            relayer3.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: new_request
                }
            }
        )

        await TestTargetInstance.setBurnAllGas();
        await TruffleAssert.fails(ForwarderInstance.execute(new_request, new_sign, {gas: 100000}));
    });

    it ('req.gas should be passed to the target contract', async () => {
        const requestGas = 100000;
        const new_request = {
            from: relayer3Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: requestGas.toString(),
            nonce: 0,
            data: '0x'
        }

        const new_sign = ethSigUtil.signTypedMessage(
            relayer3.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: new_request
                }
            }
        )

        await ForwarderInstance.execute(new_request, new_sign, {gas: 200000});
        const availableGas = await TestTargetInstance.gasLeft();
        assert(availableGas > 96000);
        assert(availableGas < requestGas);
    });

    it ('req.data should be passed to the target contract along with the req.from at the end', async () => {
        const requestData = '0x1234';
        const new_request = {
            from: relayer3Address,
            to: TestTargetInstance.address,
            value: '0',
            gas: '300000',
            nonce: 0,
            data: requestData
        }

        const new_sign = ethSigUtil.signTypedMessage(
            relayer3.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: new_request
                }
            }
        )
        await ForwarderInstance.execute(new_request, new_sign);
        const callData = await TestTargetInstance.data();
        const expectedData = requestData + relayer3Address.substr(2);
        assert.equal(callData, expectedData);
    });

    it ('req.value should be passed to the target contract', async () => {
        const request_value = Ethers.utils.parseEther('0.1');
        const new_request = {
            from: relayer3Address,
            to: TestTargetInstance.address,
            value: request_value.toString(),
            gas: '300000',
            nonce: 0,
            data: '0x'
        }

        const new_sign = ethSigUtil.signTypedMessage(
            relayer3.getPrivateKey(),
            {
                data: {
                    types: types,
                    domain: domain,
                    primaryType: 'ForwardRequest',
                    message: new_request
                }
            }
        )
        await ForwarderInstance.execute(new_request, new_sign, {value: Ethers.utils.parseEther('0.3')});
        const targetContract_balance = provider.getBalance(TestTargetInstance.address);
        assert.equal((await targetContract_balance).toString(), request_value.toString());
    });

    it ('The successful execute can not be replayed again', async () => {
        await ForwarderInstance.execute(request, sign);
        return TruffleAssert.reverts(ForwarderInstance.execute(request, sign), "MinimalForwarder: signature does not match request");
    });

    it ('Only a single call to the target is performed during the execution', async () => {
        await ForwarderInstance.execute(request, sign);
        const calls = await TestTargetInstance.calls();
        assert.equal(calls.toNumber(), 1);
    });

    it ('In case of request is matched with signature, it should be verified', async () => {
        assert.equal((await ForwarderInstance.verify(request, sign)), true);
    });

    it ('In case of request is matched with signature, it should not be reverted and nonce should be increased', async () => {
        const nonce_before_execute = await ForwarderInstance.getNonce(relayer1Address);
        await ForwarderInstance.execute(request, sign);
        const nonce_after_execute = await ForwarderInstance.getNonce(relayer1Address);
        assert.equal(nonce_after_execute.toNumber(), nonce_before_execute.toNumber() + 1);
    });
});
