/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

/**
 * Truffle config specifically for Optimistic Ethereum (OVM) 
 */

module.exports = {
  contracts_build_directory: './build/contracts/ovm',
  plugins: ["solidity-coverage"],
  networks: {

    test: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
     },
  
  },

  compilers: {
    solc: {
      version: "node_modules/@eth-optimism/solc",       
      settings: {
        optimizer: {
          enabled: true,
          runs: 1
        },
      }
    }
  }
}
