# cb-sol-cli Documentation

This CLI supports on-chain interactions with components of ChainBridge.

## Installation 

`make install`

## Usage 

The root command (`cb-sol-cli`) has some options:
```
--url <value>                 URL to connect to
--gasLimit <value>            Gas limit for transactions 
--gasPrice <value>            Gas limit for transactions 
```
\
The keypair used for interactions can be configured with:
```
--privateKey <value>           Private key to use (default: "0x000000000000000000000000000000000000000000000000000000616c696365")
```
or
```
--jsonWallet <path>           Encrypted JSON wallet
--jsonWalletPassword <value>  Password for encrypted JSON wallet
```

There are multiple subcommands provided:

- [`deploy`](./deploy.md): Deploys contracts via RPC
- [`bridge`](./bridge.md): Interactions with the bridge contract such as registering resource IDs and handler addresses
- [`admin`](./admin.md): Interactions with the bridge contract for administering relayer set, relayer threshold, fees and more.
- [`erc20`](./erc20.md): Interactions with ERC20 contracts and handlers
- [`erc721`](./erc721.md): Interactions with ERC721 contracts and handler


