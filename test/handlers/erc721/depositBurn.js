/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
 
 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');

const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721MinterBurnerPauser");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('ERC721Handler - [Deposit Burn ERC721]', async (accounts) => {
    const relayerThreshold = 2;
    const chainID = 1;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];

    const tokenID = 1;

    let BridgeInstance;
    let ERC721MintableInstance1;
    let ERC721MintableInstance2;
    let ERC721HandlerInstance;

    let resourceID1;
    let resourceID2;
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(chainID, [], relayerThreshold, 0).then(instance => BridgeInstance = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance1 = instance),
            ERC721MintableContract.new("token", "TOK", "").then(instance => ERC721MintableInstance2 = instance)
        ])

        resourceID1 = Ethers.utils.hexZeroPad((ERC721MintableInstance1.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        resourceID2 = Ethers.utils.hexZeroPad((ERC721MintableInstance2.address + Ethers.utils.hexlify(chainID).substr(2)), 32);
        initialResourceIDs = [resourceID1, resourceID2];
        initialContractAddresses = [ERC721MintableInstance1.address, ERC721MintableInstance2.address];
        burnableContractAddresses = [ERC721MintableInstance1.address]

        await Promise.all([
            ERC721HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses).then(instance => ERC721HandlerInstance = instance),
            ERC721MintableInstance1.mint(depositerAddress, tokenID, "")
        ]);

        await ERC721MintableInstance1.approve(ERC721HandlerInstance.address, tokenID, { from: depositerAddress });

        depositData = '0x' +
            resourceID1.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenID), 32).substr(2) +    // Deposit Amount        (32 bytes)
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(32), 32).substr(2) +               // len(recipientAddress) (32 bytes)
            Ethers.utils.hexZeroPad(recipientAddress, 32).substr(2);                        // recipientAddress      (?? bytes)
    });

    it('[sanity] burnableContractAddresses should be marked true in _burnList', async () => {
        for (const burnableAddress of burnableContractAddresses) {
            const isBurnable = await ERC721HandlerInstance._burnList.call(burnableAddress);
            assert.isTrue(isBurnable, "Contract wasn't successfully marked burnable");
        }
    });

    it('[sanity] ERC721MintableInstance1 tokenID has been minted for depositerAddress', async () => {
        const tokenOwner = await ERC721MintableInstance1.ownerOf(tokenID);
        assert.strictEqual(tokenOwner, depositerAddress);
    });

    it('depositAmount of ERC721MintableInstance1 tokens should have been burned', async () => {
        await BridgeInstance.deposit(
            chainID,
            ERC721HandlerInstance.address,
            depositData,
            { from: depositerAddress }
        );

        const handlerBalance = await ERC721MintableInstance1.balanceOf(ERC721HandlerInstance.address);
        assert.strictEqual(handlerBalance.toNumber(), 0);

        const depositerBalance = await ERC721MintableInstance1.balanceOf(depositerAddress);
        assert.strictEqual(depositerBalance.toNumber(), 0);

        await TruffleAssert.reverts(
            ERC721MintableInstance1.ownerOf(tokenID),
            'ERC721: owner query for nonexistent token');    });
});
