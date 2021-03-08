/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

/**
 * Truffle config specifically for Optimistic Ethereum (OVM) 
 */

const mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
const { ganache } = require('@eth-optimism/ovm-toolchain')

const GAS_LIMIT = 9000000-1
const GAS_PRICE = '0'

module.exports = {
  contracts_build_directory: './build/contracts/ovm',
  plugins: ["solidity-coverage"],
  networks: {

    test: {
      network_id: 108,
      networkCheckTimeout: 100000,
      provider: function() {
        return ganache.provider({
          mnemonic: mnemonic,
          network_id: 108,
          default_balance_ether: 100,
          gasLimit: GAS_LIMIT,
          gasPrice: GAS_PRICE,
        })
      },
      gas: GAS_LIMIT,
      gasPrice: GAS_PRICE,
    },

    local: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "420",       // optimistic-integration default chain ID
      gas: GAS_LIMIT,
      gasPrice: GAS_PRICE
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
