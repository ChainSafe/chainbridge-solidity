/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const Ethers = require('ethers');

 const createDepositData = (resourceID, tokenAmountOrID, lenRecipientAddress, recipientAddress) => {
    return '0x' +
        resourceID.substr(2) +
        Ethers.utils.hexZeroPad(Ethers.utils.hexlify(tokenAmountOrID), 32).substr(2) +      // Token amount or ID to deposit (32 bytes)
        Ethers.utils.hexZeroPad(Ethers.utils.hexlify(lenRecipientAddress), 32).substr(2) + // len(recipientAddress)          (32 bytes)
        recipientAddress.substr(2);                                                        // recipientAddress               (?? bytes)
};

const assertObjectsMatch = (expectedObj, actualObj) => {
    for (const expectedProperty of Object.keys(expectedObj)) {
        assert.property(actualObj, expectedProperty, `actualObj does not have property: ${expectedProperty}`);

        let expectedValue = expectedObj[expectedProperty];
        let actualValue = actualObj[expectedProperty];

        // Handling mixed case ETH addresses
        if (expectedValue.toLowerCase !== undefined) {
            expectedValue = expectedValue.toLowerCase();
        }

        // Handling mixed case ETH addresses
        if (actualValue.toLowerCase !== undefined) {
            actualValue = actualValue.toLowerCase();
        }

        // Handling BigNumber.js instances
        if (actualValue.toNumber !== undefined) {
            actualValue = actualValue.toNumber();
        }

        assert.equal(expectedValue, actualValue, `expectedValue does not match actualValue`);
    }
};

module.exports = {
    createDepositData,
    assertObjectsMatch
};
