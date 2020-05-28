# Deploy Command

This command can be used to deploy all or some of the contracts required for bridging.

Selection of contracts can be made by either specifying `--all` or a subset of these:
```
  --bridge                     Deploy bridge contract
  --erc20Handler               Deploy erc20Handler contract
  --erc721Handler              Deploy erc721Handler contract
  --genericHandler             Deploy genericHandler contract
  --erc20                      Deploy erc20 contract
  --erc721                     Deploy erc721 contract
  --centAsset                  Deploy centrifuge asset contract
```

If you are deploying the Bridge contract, you may want to specify these options as well:
```
  --chainId <value>           Chain ID for the instance (default: 0)
  --relayers <value>          List of initial relayers (default: ["0xff93B45308FD417dF303D6515aB04D9e89a750Ca","0x8e0a907331554AF72563Bd8D43051C2E64Be5d35","0x24962717f8fA5BA3b931bACaF9ac03924EB475a0","0x148FfB2074A9e59eD58142822b3eB3fcBffb0cd7","0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485"])
  --relayerThreshold <value>  Number of votes required for a proposal to pass (default: 2)
  --fee <value>               Fee to be taken when making a deposit (in Ether) (default: 0)
```