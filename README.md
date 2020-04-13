# chainbridge-solidity

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

### cb-sol-cli (JS CLI)

This is a small CLI application to deploy the contracts and interact with the chain. To install run `make install-cli`.

#### Global Flags
```
-h, --host <host> default: localhost (127.0.0.1)
-p, --port <port> default: 8545
```
#### deploy

Deploy contracts with configurable constructor arguments. Relayers will be added from default keys (max 5).
```
cb-sol-cli deploy --validator-threshold <n> --relayers <n>
```

#### mint

Mint default erc20 tokens.
```
cb-sol-cli mint --value <n>
```

#### transfer

Initiate a transfer of erc20 to some destination chain.
```
cb-sol-cli transfer --value <n> --dest <n> --recipient <addr>
```

#### Transfering and verifying a Centrifuge hash

Initiate a transfer of a hash to some destination chain.
```
cb-sol-cli sendCentHash --hash <hash> --originChain <chainId> --destChain <chianId>
```
Verify the hash was deposited
```
cb-sol-cli getCentHash --hash <hash> --centAddress <address>
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
    uint256 destinationChainID,
    uint256 depositNonce,
    address depositer,
    bytes memory data
    ) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:

```
originChainTokenAddress                address     bytes   0 - 32
amount                                 uint256     bytes  32 - 64
destinationRecipientAddress length     uint256     bytes  64 - 96
destinationRecipientAddress            bytes       bytes  96 - END
```

When retriving the calldata of the function call, it is laid out as follows:

```
originChainTokenAddress                address     - @0x84 - 0xA4
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
    uint256 destinationChainID, 
    uint256 depositNonce, 
    address depositer, 
    bytes memory data
    ) public override _onlyBridge
```

`bytes memory data` passed into the function should be constructed as follows:

```
originChainTokenAddress                     address    bytes     0 - 32
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
originChainTokenAddress                address     - @0x84 - 0xA4
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
    uint256 destinationChainID, 
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
    uint256 destinationChainID, 
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