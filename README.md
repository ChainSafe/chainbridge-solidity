# chainbridge-solidity

[![Coverage Status](https://coveralls.io/repos/github/ChainSafe/chainbridge-solidity/badge.svg?branch=master)](https://coveralls.io/github/ChainSafe/chainbridge-solidity?branch=master)

ChainBridge uses Solidity smart contracts to enable transfers to and from EVM compatible chains. These contracts consist of a core bridge contract (Bridge.sol) and a set of handler contracts (ERC20Handler.sol, ERC721Handler.sol, and GenericHandler.sol). The bridge contract is responsible for initiating, voting on, and executing proposed transfers. The handlers are used by the bridge contract to interact with other existing contracts.

Read more [here](https://www.notion.so/chainsafe/ChainBridge-Solidity-ad0b0e53e5204e7c8e5e850cbd40392b).

## Dependencies

Requires `nodejs` and `npm`.

## Commands

`make install-deps`: Installs truffle and ganache globally, fetches local dependencies. Also installs `abigen` from `go-ethereum`.

`make bindings`: Creates go bindings in `./build/bindings/go`

`PORT=<port> SILENT=<bool> make start-ganache`: Starts a ganache instance, default `PORT=8545 SILENT=false`

`QUIET=<bool> make start-geth`: Starts a geth instance with test keys

`PORT=<port> make deploy`: Deploys all contract instances, default `PORT=8545`

`make test`: Runs truffle tests.

`make compile`: Compile contracts.

## cb-sol-cli (JS CLI)

This is a small CLI application to deploy the contracts and interact with the chain. It consists of four main sub-commands `deploy`, `erc20`, `erc721`, and `cent`. To install run `make install-cli`.

#### Global Flags
```
  --url <value>                   URL to connect to (default: "http://localhost:8545")
  --private-key <value>           Private key to use (default: "0x000000000000000000000000000000000000000000000000000000616c696365")
  --json-wallet <path>            (Optional) Encrypted JSON wallet
  --json-wallet-password <value>  (Optional) Password for encrypted JSON wallet
  --gas-limit <value>             Gas limit for transactions (default: "8000000")
  --gas-price <value>             Gas limit for transactions (default: "20000000")
  -h, --help                      display help for command
```
### `deploy`

Deploy contracts with configurable constructor arguments. Relayers will be added from default keys (max 5).


```
$ cb-sol-cli deploy

Options:
 --chain-id <value>           Chain ID for the instance (default: 0)
 --relayers <value>           List of initial relayers (default:
                               ["0xff93B45308FD417dF303D6515aB04D9e89a750Ca","0x8e0a907331554AF72563Bd8D43051C2E64Be5d35","0x24962717f8fA5BA3b931bACaF9ac03924EB475a0","0x148FfB2074A9e59eD58142822b3eB3fcBffb0cd7","0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485"])
 --relayer-threshold <value>  Number of votes required for a proposal to pass (default: 2)
```

### `bridge`

#### - `register-resource`

Register a resource ID with a contract address for a handler

```
$ cb-sol-cli bridge register-resource

Options:
  --bridge <address>          Custom bridge address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --handler <address>         Custom handler (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --targetContract <address>  Custom addresses to be whitelisted (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --resourceID <address>      Custom resourceID to be whitelisted (default: "0x00000000000000000000003167776db165D8eA0f51790CA2bbf44Db5105ADF00")
```

#### - `register-generic-resource`
Register a resource ID with a generic handler

```
$ cb-sol-cli bridge register-generic-resource

Options:
  --bridge <address>          Custom bridge address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --handler <address>         Custom handler (default: "0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31")
  --targetContract <address>  Custom addresses to be whitelisted (default: "0xc279648CE5cAa25B9bA753dAb0Dfef44A069BaF4")
  --resourceID <address>      Custom resourceID to be whitelisted (default: "0x0000000000000000000000c279648CE5cAa25B9bA753dAb0Dfef44A069BaF400")
  --deposit <string>          Function signature of the deposit functions (default: "0x00000000")
  --execute <string>          Function signature of the proposal execution function (default: "0x00000000")
  --hash                      Treat signature inputs as function signature strings, hash and take the first 4 bytes (default: false)
```


#### - `set-burn`
Set a a token contract as mintable/burnable in a handler.

```
$ cb-sol-cli bridge set-burn

Options:
  --bridge <address>         Custom bridge address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --handler <address>        Custom erc20 handler (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --tokenContract <address>  Custom addresses to be whitelisted (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

### `erc20`

#### - `mint` 
Mint default erc20 tokens.

```
$ cb-sol-cli erc20 mint

Options:
  --value <amount>          Amount to mint (default: 100)
  --erc20Address <address>  Custom erc20 address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

#### - `transfer`
Initiate a transfer of erc20 to some destination chain.
```
$ cb-sol-cli erc20 transfer

Options:
  --value <amount>                 Amount to transfer (default: 1)
  --dest <value>                   destination chain (default: 1)
  --recipient <address>            Destination recipient address (default: "0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485")
  --erc20Address <address>         Custom erc20 address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --erc20HandlerAddress <address>  Custom erc20Handler contract (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --bridgeAddress <address>        Custom bridge address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
```

#### - `balance`
Check the balance of an account.
```
$ cb-sol-cli erc20 balance

Options:
  --address <address>       Address to query (default: "0xff93B45308FD417dF303D6515aB04D9e89a750Ca")
  --erc20Address <address>  Custom erc20 address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

### `erc721`

#### - `mint`
Mint default erc721 tokens.

```
$ cb-sol-cli erc721 mint

Options:
  --erc721Address <address>  Custom erc721 contract (default: "0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07")
  --id <id>                  ERC721 token id (default: 1)
  --metadata <bytes>         Metadata (tokenURI) for token (default: "")
```

#### - `transfer`
Initiate a transfer of erc721 to some destination chain.
```
$ cb-sol-cli erc721 transfer

  --id <id>                         ERC721 token id (default: 1)
  --dest <value>                    destination chain (default: 1)
  --recipient <address>             Destination recipient address (default: "0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485")
  --erc721Address <address>         Custom erc721 contract (default: "0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07")
  --erc721HandlerAddress <address>  Custom erc721 handler (default: "0x21605f71845f372A9ed84253d2D024B7B10999f4")
  --bridgeAddress <address>         Custom bridge address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
```

### Centrifuge (`cent`)

#### - `getHash`
Verify transfer of hash:

```
$ cb-sol-cli cent getHash

Options:
  --hash <value>     A hash to lookup (default: "0x0000000000000000000000000000000000000000000000000000000000000000")
  --address <value>  Centrifuge asset store contract address (default: "0xc279648CE5cAa25B9bA753dAb0Dfef44A069BaF4")
```

