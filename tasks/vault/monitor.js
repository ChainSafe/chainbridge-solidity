const { task } = require('hardhat/config')

/**
 * Monitors SXVault contract for deposit and execute events
 *
 * npx hardhat sx-vault:monitor --network toronto --vaultaddress 0xD43C150576e2423e4a4F54cdefDC7595886E96A2
 * npx hardhat sx-vault:monitor --network localhost --vaultaddress 0x28390d71d2f9A5dC991eA96B83BEB350bd49ABAb
 */
task('sx-vault:monitor', 'Monitor SXVault contract')
  .addParam('vaultaddress', 'Address of SXVault')
  .setAction(async function ({ vaultaddress }) {
    const SXVault = await ethers.getContractFactory('SXVault')

    const vault = SXVault.attach(vaultaddress)

    //await vault.bridgeExit("0x32fd9b6A452dB4567D6525c67424F0499968EA63", ethers.utils.parseEther("10"))

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
