# cb-sol-cli Documentation

This CLI supports on-chain interactions with components of ChainBridge.

## Installation 

`make install`

## Usage 

The root command (`cb-sol-cli`) has some options:
```
--url <value>                   URL to connect to (default: "http://localhost:8545")
--gas-limit <value>             Gas limit for transactions (default: "8000000")
--gas-price <value>             Gas limit for transactions (default: "20000000")
```


The keypair used for interactions can be configured with:
```
--private-key <value>           Private key to use (default: "0x000000000000000000000000000000000000000000000000000000616c696365")
```
or
```
--json-wallet <path>            Encrypted JSON wallet
--json-wallet-password <value>  Password for encrypted JSON wallet
```

There are multiple subcommands provided:

- [`deploy`](./deploy.md): Deploys contracts via RPC
- [`bridge`](./bridge.md): Interactions with the bridge contract such as registering resource IDs and handler addresses
- [`erc20`](./erc20.md): Interactions with ERC20 contracts and handlers
- [`erc721`](./erc721.md): Interactions with ERC721 contracts and handler


