const { task } = require('hardhat/config')

/**
 * Sets the SXVault contract address on ERC20SXHandler
 *
 * TORONTO: npx hardhat handler:set-sxvault --network toronto --handleraddress 0x057C1202cb39c949ed7cce74fBbc8DaB4E3A5A69 --sxvaultaddress 0xa3DA53832f9BC740a95F39C9283C095E5548A9Ce
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