# chainbridge-solidity

[![Coverage Status](https://coveralls.io/repos/github/ChainSafe/chainbridge-solidity/badge.svg?branch=master)](https://coveralls.io/github/ChainSafe/chainbridge-solidity?branch=master)

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
  --url <value>          URL to connect to (default: "http://localhost:8545")
  --private-key <value>  Private key to use (default: "0x000000000000000000000000000000000000000000000000000000616c696365")
  -h, --help             display help for command
```
### `deploy`

Deploy contracts with configurable constructor arguments. Relayers will be added from default keys (max 5).


```
$ cb-sol-cli deploy

Options:
  --chain-id <value>           Chain ID for the instance (default: 0)
  --relayers <value>           List of initial relayers (default: ["0xff93B45308FD417dF303D6515aB04D9e89a750Ca","0x8e0a907331554AF72563Bd8D43051C2E64Be5d35","0x24962717f8fA5BA3b931bACaF9ac03924EB475a0","0x148FfB2074A9e59eD58142822b3eB3fcBffb0cd7","0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485"])
  --relayer-threshold <value>  Number of votes required for a proposal to pass (default: 2)
```

### `erc20`

#### - `mint` 
Mint default erc20 tokens.

```
$ cb-sol-cli erc20 mint

Options:
  --value <amount>          Amount to mint (default: 100)
  --erc20Address <address>  Custom erc20 address (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
```

#### - `whitelist`
Whitelist a resourceID and tokenAddress pair
```
$ cb-sol-cli erc20 whitelist

Options:
  --bridgeAddress <address>           Custom bridge address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --tokenContract <address>           Custom erc20 token address to whitelist (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --resourceID <id>                   Custom resourceID to whitelist (default: "0x00000000000000000000003f709398808af36ADBA86ACC617FeB7F5B7B193E00")
  --erc20HandlerAddress <address>`    Custom erc20Handler contract (default: "0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07")
```

#### - `transfer`
Initiate a transfer of erc20 to some destination chain.
```
$ cb-sol-cli erc20 transfer

Options:
  --value <amount>                 Amount to transfer (default: 1)
  --dest <value>                   destination chain (default: 1)
  --recipient <address>            Destination recipient address (default: "0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485")
  --erc20Address <address>         Custom erc20 address (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --erc20HandlerAddress <address>  Custom erc20Handler contract (default: "0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07")
  --bridgeAddress <address>        Custom bridge address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

#### - `balance`
Check the balance of an account.
```
$ cb-sol-cli erc20 balance

Options:
  --address <address>       Address to query (default: "0xff93B45308FD417dF303D6515aB04D9e89a750Ca")
  --erc20Address <address>  Custom erc20 address (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
```

### `erc721`

#### - `mint`
Mint default erc721 tokens.

```
$ cb-sol-cli erc721 mint

Options:
  --erc721Address <address>  Custom erc721 contract (default: "0x21605f71845f372A9ed84253d2D024B7B10999f4")
  --id <id>                  ERC721 token id (default: 1)
```
#### - `whitelist`
Whitelist a resourceID and tokenAddress pair
```
$ cb-sol-cli erc721 whitelist

Options:
  --bridgeAddress <address>           Custom bridge address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --tokenContract <address>           Custom erc721 token address to whitelist (default: "0x21605f71845f372A9ed84253d2D024B7B10999f4")
  --resourceID <id>                   Custom resourceID to whitelist (default: "0x000000000000000000000021605f71845f372A9ed84253d2D024B7B10999f400")
  --erc721HandlerAddress <address>`   Custom erc721Handler contract (default: "0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31")
```

#### - `transfer`
Initiate a transfer of erc721 to some destination chain.
```
$ cb-sol-cli erc721 transfer

  --id <id>                         ERC721 token id (default: 1)
  --dest <value>                    destination chain (default: 1)
  --recipient <address>             Destination recipient address (default: "0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485")
  --erc721Address <address>         Custom erc721 contract (default: "0x21605f71845f372A9ed84253d2D024B7B10999f4")
  --erc721HandlerAddress <address>  Custom erc721 handler (default: "0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31")
  --bridgeAddress <address>         Custom bridge address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

### Centrifuge (`cent`)

#### - `transferHash`
Initiate transfer of a hash.

```
$ cb-sol-cli cent transferHash

Options:
  --hash <value>           The hash that will be transferred (default: "0x0000000000000000000000000000000000000000000000000000000000000001")
  --dest-id <value>        The cahin where the deposit will finalize (default: 1)
  --centAddress <value>    Centrifuge handler contract address (default: "0xc279648CE5cAa25B9bA753dAb0Dfef44A069BaF4")
  --bridgeAddress <value>  Bridge contract address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

#### - `getHash`
Verify transfer of hash:

```
$ cb-sol-cli cent getHash

Options:
  --hash <value>         A hash to lookup (default: "0x0000000000000000000000000000000000000000000000000000000000000001")
  --centAddress <value>  Centrifuge handler contract address (default: "0xc279648CE5cAa25B9bA753dAb0Dfef44A069BaF4")
```

# ChainBridge-Solidity Data Layout

## resourceID

`resourceID` is a `bytes32` array laid out as follows:

```
tokenAddress                address   - bytes 11 - 32 
chainID                     uint256   - byte  32      

```

## ERC20Handler.sol

### deposit

```   
function deposit(
    uint8 destinationChainID,
    uint256 depositNonce,
    address depositer,
    bytes memory data
    ) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:

```
resourceID                             bytes32     bytes   0 - 32
amount                                 uint256     bytes  32 - 64
destinationRecipientAddress length     uint256     bytes  64 - 96
destinationRecipientAddress            bytes       bytes  96 - END
```

When retriving the calldata of the function call, it is laid out as follows:

```
resourceID                             bytes32     - @0x84 - 0xA4
amount                                 uint256     - @0xA4 - 0xC4
------------------------------------------------------------------
destinationRecipientAddress length     uint256     - @0xC4 - 0xE4
destinationRecipientAddress            bytes       - @0xE4 - END

```

### executeDeposit

```
function executeDeposit(bytes memory data) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:


```
amount                                 uint256     bytes   0 - 32
resourceID                             bytes32     bytes  32 - 64
--------------------------------------------------------------------
destinationRecipientAddress length     uint256     bytes  64 - 96
destinationRecipientAddress            bytes       bytes  96 - END
```

When retriving the calldata of the function call, it is laid out as follows:

```
amount                          uint256     - @0x24 - 0x44
resourceID                      uint256     - @0x44 - 0x64
--------------------------------------------------------------------
destinationRecipientAddress len uint256     - @0x64 - 0x84
destinationRecipientAddress     bytes       - @0x84 - END
```

## ERC721Handler.sol

### deposit

```
function deposit(
    uint8 destinationChainID, 
    uint256 depositNonce, 
    address depositer, 
    bytes memory data
    ) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:

```
resourceID                                  bytes32    bytes     0 - 32
tokenID                                     uint256    bytes    32 - 64
--------------------------------------------------------------------------------------------------------------------
destinationRecipientAddress     length      uint256    bytes    64 - 96
destinationRecipientAddress                   bytes    bytes    96 - (96 + len(destinationRecipientAddress))
--------------------------------------------------------------------------------------------------------------------
metadata                        length      uint256    bytes    (96 + len(destinationRecipientAddress)) - (96 + len(destinationRecipientAddress) + 32)
metadata                                      bytes    bytes    (96 + len(destinationRecipientAddress) + 32) - END
```

When retriving the calldata of the function call, it is laid out as follows:

```
resourceID                             bytes32     - @0x84 - 0xA4
tokenID                                uint256     - @0xA4 - 0xC4
------------------------------------------------------------------
destinationRecipientAddress length     uint256     - @0xC4 - 0xE4
destinationRecipientAddress            bytes       - @0xE4 - (0xE4 + len(destinationRecipientAddress))
------------------------------------------------------------------
metadata                    length     uint256     - @(0xE4 + len(destinationRecipientAddress)) - (0xE4 + len(destinationRecipientAddress) + 0x20)
metadata                               bytes       - @(0xE4 + len(destinationRecipientAddress) + 0x20) - END

```


### executeDeposit

```
function executeDeposit(bytes memory data) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:
```
tokenID                                     uint256    bytes     0 - 32
resourceID                                  bytes32    bytes    32 - 64
--------------------------------------------------------------------------------------------------------------------
destinationRecipientAddress     length      uint256    bytes    64 - 96
destinationRecipientAddress                   bytes    bytes    96 - (96 + len(destinationRecipientAddress))
--------------------------------------------------------------------------------------------------------------------
metadata                        length      uint256    bytes    (96 + len(destinationRecipientAddress)) - (96 + len(destinationRecipientAddress) + 32)
metadata                                      bytes    bytes    (96 + len(destinationRecipientAddress) + 32) - END
```

When retriving the calldata of the function call, it is laid out as follows:
```
tokenID                                     uint256    bytes  - @0x24 - 0x44
resourceID                                  bytes32    bytes  - @0x44 - 0x64
---------------------------------------------------------------------------------------------------------------------
destinationRecipientAddress     length      uint256    bytes  - @0x64 - 0x84
destinationRecipientAddress                   bytes    bytes  - @0x84 - (0x84 + len(destinationRecipientAddress))
---------------------------------------------------------------------------------------------------------------------
metadata                        length      uint256    bytes  - @(0x84 + len(destinationRecipientAddress)) - (0x84 + len(destinationRecipientAddress) + 0x20)  
metadata                                      bytes    bytes  - @(0x84 + len(destinationRecipientAddress) + 0x20) - END  
```


## GenericHandler.sol

### deposit

```
function deposit(
    uint8 destinationChainID, 
    uint256 depositNonce, 
    address depositer, 
    bytes memory data
    ) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:

```

destinationRecipientAddress                address   bytes     0 - 32
resourceID                                 bytes32   bytes    32 - 64
----------------------------------------------------------------------------
metadata                     length        uint256   bytes    64 - 96
metadata                                   bytes     bytes    96 - END
```

When retriving the calldata of the function call, it is laid out as follows:

```

destinationRecipientAddress                address     - @0x84 - 0xA4
resourceID                                 uint256     - @0xA4 - 0xC4
------------------------------------------------------------------
metadata                      length       uint256     - @0xC4 - 0xE4
metadata                                   bytes       - @0xE4 - END

```




### executeDeposit

Currently unimplemented.

## CentrifugeAssetHandler.sol

### deposit

```
function deposit(
    uint8 destinationChainID, 
    uint256 depositNonce, 
    address depositer, 
    bytes memory data
    ) public override _onlyBridge
```
`bytes memory data` passed into the function should be constructed as follows:

```
originChainContractAddress                 address   bytes     0 - 32
destinationRecipientAddress                bytes32   bytes    32 - 64
metadataHash                               bytes     bytes    64 - 96
```

When retriving the calldata of the function call, it is laid out as follows:

```

originChainContractAddress                 address     - @0x84 - 0xA4
destinationRecipientAddress                address     - @0xA4 - 0xC4
metadataHash                               uint256     - @0xC4 - 0xE4

```

### executeDeposit

```
function executeDeposit(bytes memory data) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:

```
metadataHash                               bytes     bytes    0 - 32
```

When retriving the calldata of the function call, it is laid out as follows:
```
metadataHash                               bytes    bytes  - @0x24 - 0x44
```
