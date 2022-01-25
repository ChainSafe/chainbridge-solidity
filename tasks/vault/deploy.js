const { task } = require('hardhat/config')

/**
 * Deploys the SXVault contract
 *
 * TORONTO: npx hardhat sx-vault:deploy --network toronto --handleraddress 0x3305BF417B92bd1E726B4B076B2495b49CA7b172
 */
task('sx-vault:deploy', 'Deploys the SXVault contract')
  .addParam('handleraddress', 'Address of ChainBridge GenericHandler')
  .setAction(async function ({ handleraddress }) {
    const [deployer] = await ethers.getSigners()
    console.log('Deploying contracts with the account:', deployer.address)
    console.log('Account balance:', (await deployer.getBalance()).toString())

    // Deploy sx vault
    const SXVaultContract = await ethers.getContractFactory('SXVault')
    const sxVault = await SXVaultContract.deploy(handleraddress)

    console.log('Done - SXVault address: ' + sxVault.address)
  })
