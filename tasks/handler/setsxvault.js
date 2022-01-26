const { task } = require('hardhat/config')

/**
 * Sets the SXVault contract address on ERC20SXHandler
 *
 * TORONTO: npx hardhat handler:set-sxvault --network toronto --handleraddress 0xbFeaf00c36b7B73A844fBa7DDB1351478f789d60 --sxvaultaddress 0xc5234eF2AeCc4527b4DAF9178Cd92456996c3fc5
 */
task('handler:set-sxvault', 'Sets the SXVault contract address on ERC20SXHandler')
  .addParam('handleraddress', 'Address of ERC20SXHandler contract')  
  .addParam('sxvaultaddress', 'Address of SXVault contract')
  .setAction(async function ({ handleraddress, sxvaultaddress }) {
    const [deployer] = await ethers.getSigners()

    const ERC20SXHandler = await ethers.getContractFactory('ERC20SXHandler')
    const handler = ERC20SXHandler.attach(handleraddress)

    const result = await handler.setSxVaultContract(sxvaultaddress)
    const receipt = await result.wait()
    console.log('Done: ' + receipt.transactionHash)
  })