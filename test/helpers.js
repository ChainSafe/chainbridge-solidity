/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const Ethers = require('ethers');

 const blankFunctionSig = '0x00000000';
 const AbiCoder = new Ethers.utils.AbiCoder;

 const toHex = (covertThis, padding) => {
    return Ethers.utils.hexZeroPad(Ethers.utils.hexlify(covertThis), padding);
 };

 const abiEncode = (valueTypes, values) => {
    return AbiCoder.encode(valueTypes, values)
 };

 const getFunctionSignature = (contractInstance, functionName) => {
    return contractInstance.abi.filter(abiProperty => abiProperty.name === functionName)[0].signature;
 };

 const createERCDepositData = (resourceID, tokenAmountOrID, lenRecipientAddress, recipientAddress) => {
    return '0x' +
        resourceID.substr(2) +
        toHex(tokenAmountOrID, 32).substr(2) +      // Token amount or ID to deposit (32 bytes)
        toHex(lenRecipientAddress, 32).substr(2) + // len(recipientAddress)          (32 bytes)
        recipientAddress.substr(2);                                                        // recipientAddress               (?? bytes)
};

const createGenericDepositData = (resourceID, hexMetaData) => {
    if (hexMetaData === null) {
        return '0x' +
            resourceID.substr(2) +
            toHex(0, 32).substr(2) // len(metaData) (32 bytes)
    }
    
    const hexMetaDataLength = (hexMetaData.substr(2)).length / 2;
    return '0x' +
        resourceID.substr(2) +
        toHex(hexMetaDataLength, 32).substr(2) +
        hexMetaData.substr(2)
};

const createResourceID = (contractAddress, chainID) => {
    return toHex(contractAddress + toHex(chainID, 0).substr(2), 32)
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
    toHex,
    abiEncode,
    getFunctionSignature,
    createERCDepositData,
    createGenericDepositData,
    createResourceID,
    assertObjectsMatch
};
