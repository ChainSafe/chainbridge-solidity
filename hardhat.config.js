require('@nomiclabs/hardhat-waffle')
require('./tasks/vault/deploy')
require('./tasks/vault/monitor')
require('dotenv').config()

module.exports = {
  networks: {
    localhost1: {
      url: 'http://localhost:8545',
      chainId: 5,
      accounts: [process.env.PK_CHAINBRIDGE_LOCAL],
    },
    localhost2: {
      url: 'http://localhost:8546',
      chainId: 5,
      accounts: [process.env.PK_CHAINBRIDGE_LOCAL],
    },
    toronto: {
      url: 'https://rpc.toronto.sx.technology',
      chainId: 647,
      accounts: [process.env.PK_TORONTO_DEPLOYER, process.env.KONSTANTIN_TORONTO],
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.6.4',
      },
    ],
  },
}
