/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const Ethers = require('ethers');

 const blankFunctionSig = '0x00000000';

 const getFunctionSignature = (contractInstance, functionName) => {
    return contractInstance.abi.filter(abiProperty => abiProperty.name === functionName)[0].signature;
 };

 const createERCDepositData = (resourceID, tokenAmountOrID, lenRecipientAddress, recipientAddress) => {
    return '0x' +
        resourceID.substr(2) +
        Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenAmountOrID), 32).substr(2) +      // Token amount or ID to deposit (32 bytes)
        Ethers.utils.hexZeroPad(Ethers.utils.hexlify(lenRecipientAddress), 32).substr(2) + // len(recipientAddress)          (32 bytes)
        recipientAddress.substr(2);                                                        // recipientAddress               (?? bytes)
};

const createGenericDepositData = (resourceID, hexMetaData) => {
    if (hexMetaData === null) {
        return '0x' +
            resourceID.substr(2) +
            Ethers.utils.hexZeroPad(Ethers.utils.hexlify(0), 32).substr(2) // len(metaData) (32 bytes)
    }
    
    const metaDataLength = (hexMetaData.substr(2)).length / 2;
    return '0x' +
        resourceID.substr(2) +
        Ethers.utils.hexZeroPad(Ethers.utils.hexlify(metaDataLength), 32).substr(2) + // len(metaData) (32 bytes)
        hexMetaData.substr(2);
};

const createResourceID = (contractAddress, chainID) => {
    return Ethers.utils.hexZeroPad((contractAddress + Ethers.utils.hexlify(chainID).substr(2)), 32)
};

const assertObjectsMatch = (expectedObj, actualObj) => {
    for (const expectedProperty of Object.keys(expectedObj)) {
        assert.property(actualObj, expectedProperty, `actualObj does not have property: ${expectedProperty}`);

        let expectedValue = expectedObj[expectedProperty];
        let actualValue = actualObj[expectedProperty];

        // If expectedValue is not null, we can expected actualValue to not be null as well
        if (expectedValue !== null) {
            // Handling mixed case ETH addresses
            // If expectedValue is a string, we can expected actualValue to be a string as well
            if (expectedValue.toLowerCase !== undefined) {
                expectedValue = expectedValue.toLowerCase();
                actualValue = actualValue.toLowerCase();
            }

            // Handling BigNumber.js instances
            if (actualValue.toNumber !== undefined) {
                actualValue = actualValue.toNumber();
            }
        }

        assert.equal(expectedValue, actualValue, `expectedValue does not match actualValue`);
    }
};

module.exports = {
    blankFunctionSig,
    getFunctionSignature,
    createERCDepositData,
    createGenericDepositData,
    createResourceID,
    assertObjectsMatch
};
