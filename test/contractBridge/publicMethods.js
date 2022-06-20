/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');

 const Helpers = require('../helpers');

 const BridgeContract = artifacts.require("Bridge");

 // This test does NOT include all getter methods, just
 // getters that should work with only the constructor called
 contract('Bridge - [public]', async (accounts) => {
     const domainID = 1;

     const txHash = "0x59d881e01ca682130e550e3576b6de760951fb45b1d5dd81342132f57920bbfa";

     let BridgeInstance;


     beforeEach(async () => {
         BridgeInstance = await BridgeContract.new(domainID);

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
     });

     // Testing public methods

     it('Should successfully emit Retry event', async () => {
         const eventTx = await BridgeInstance.retry(txHash);

         TruffleAssert.eventEmitted(eventTx, 'Retry', (event) => {
          return event.txHash === txHash
      });
     });
 });
