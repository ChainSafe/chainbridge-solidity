const { task } = require('hardhat/config')

/**
 * Monitors SXVault contract for deposit and execute events
 *
 * npx hardhat sx-vault:monitor --network toronto --vaultaddress 0x050964EECB3824A8B75729e7388f810eb8acCd56
 */
task('sx-vault:monitor', 'Monitor SXVault contract')
  .addParam('vaultaddress', 'Address of SXVault')
  .setAction(async function ({ vaultaddress }) {
    const SXVault = await ethers.getContractFactory('SXVault')

    const vault = SXVault.attach(vaultaddress)

    console.log('Deposit signature: ' + vault.interface.getSighash('deposit'))
    console.log('Execute signature: ' + vault.interface.getSighash('execute'))

    //eventSignature: "Deposit(address,uint256)" 0x47e7ef24
    vault.on('Deposit', async (deposit) => {
      console.log(`Deposited!`)
    })

    //eventSignature: "Execute(address,uint256)" 0x3b89bb86
    vault.on('Execute', async (execute) => {
      console.log('Executed!')
    })

    /*
    try {
      const deposit = await vault.deposit('0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B', 4)
      const receipt = await deposit.wait()
      for (const event of receipt.events) {
        console.log(JSON.stringify(event))
      }
    } catch (err) {
      console.error(err)
    }
    const execute = await vault.execute('0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B', 4)
    */

    await new Promise((res) => setTimeout(() => res(null), 60000))
  })
