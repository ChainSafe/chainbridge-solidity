const { task } = require('hardhat/config')

/**
 * Sets the SXVault contract address on ERC20SXHandler
 *
 * TORONTO: npx hardhat handler:set-sxvault --network toronto --handleraddress 0xa64CB0eE892a2C84D72e2c2cB8fFdEef1cb7bfD5 --sxvaultaddress 0x4090CC97A2A8fC6A3f7721558Ea8b9650DEbD708
 */
task('handler:set-sxvault', 'Sets the SXVault contract address on ERC20SXHandler')
  .addParam('handleraddress', 'Address of ERC20SXHandler contract')  
  .addParam('sxvaultaddress', 'Address of SXVault contract')
  .setAction(async function ({ handleraddress, sxvaultaddress }) {
    const ERC20SXHandler = await ethers.getContractFactory('ERC20SXHandler')
    const handler = ERC20SXHandler.attach(handleraddress)

    const result = await handler.setSxVaultContract(sxvaultaddress)
    const receipt = await result.wait()
    console.log('Done: ' + receipt.transactionHash)
  })