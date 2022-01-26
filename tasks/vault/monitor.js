const { task } = require('hardhat/config')

/**
 * Monitors SXVault contract for deposit and execute events
 *
 * npx hardhat sx-vault:monitor --network toronto --vaultaddress 0xD43C150576e2423e4a4F54cdefDC7595886E96A2
 */
task('sx-vault:monitor', 'Monitor SXVault contract')
  .addParam('vaultaddress', 'Address of SXVault')
  .setAction(async function ({ vaultaddress }) {
    const SXVault = await ethers.getContractFactory('SXVault')

    const vault = SXVault.attach(vaultaddress)

    //eventSignature: "Deposit(address,uint256)" 0x47e7ef24
    vault.on('Deposit', async (deposit) => {
      console.log(`Deposited!`)
    })

    //eventSignature: "Execute(address,uint256)" 0x3b89bb86
    vault.on('Execute', async (execute) => {
      console.log('Executed!')
    })

    await new Promise((res) => setTimeout(() => res(null), 60000))
  })
