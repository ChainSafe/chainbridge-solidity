# chainbridge-solidity

## Dependencies

Requires `nodejs` and `npm`.

## Commands

`make install-deps`: Installs truffle and ganache globally, fetches local dependencies. Also installs `abigen` from `go-ethereum`.

`make bindings`: Creates go bindings in `./build/bindings/go`

`PORT=<port> SILENT=<bool> make start-ganache`: Starts a ganache instance, default `PORT=8545 SILENT=false`

`PORT=<port> make deploy`: Deploys all contract instances, default `PORT=8545`

`make test`: Runs truffle tests.

`make compile`: Compile contracts.

### cb-sol-cli (JS CLI)

This is a small CLI application to deploy the contracts and interact with the chain. To install run `make install-cli`.

#### deploy

Deploy contracts with configurable constructor arguments. Relayers will be added from default keys (max 5).
```
cb-sol-cli deploy --port <port> --validator-threshold <n> --relayers <n>
```

#### mint

Mint default erc20 tokens.
```
cb-sol-cli mint --port <port> --value <n>
```

#### transfer

Initiate a transfer of erc20 to some destination chain.
```
cb-sol-cli transfer --port <port> --value <n> --dest <n>
```

# ChainBridge-Solidity Data Layout

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
`bytes memory data` is laid out as following:
```
originChainTokenAddress     address   - @0x20
amount                      uint256   - @0x40
destinationRecipientAddress           - @0x60 - END
```

### executeDeposit

```
function executeDeposit(bytes memory data) public override _onlyBridge
```
`bytes memory data` is laid out as following (since we know `len(tokenID) = 64`):

```
amount                      uint256   - @0x20 - 0x40
tokenID                               - @0x40 - 0xC0
-----------------------------------------------------
tokenID len                 uint256   - @0x40 - 0x60
tokenID                     bytes     - @0x60 - 0xA0
-----------------------------------------------------
destinationRecipientAddress           - @0xA0 - END
-----------------------------------------------------
destinationRecipientAddress len uint256 - @0xA0 - 0xC0
destinationRecipientAddress     bytes   - @0xC0 - END

```

### tokenID in ERC20Handler is different from other tokenIDs

`tokenID` is a `bytes` array laid out as follows:

```
chainID                     uint256   - @0x00 - 0x20
tokenAddress                address   - @0x20 - 0x40

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

`bytes memory data` is laid out as following:
```
originChainTokenAddress        address   - @0x20 - 0x40
destinationChainTokenAddress   address   - @0x40 - 0x60
destinationRecipientAddress    address   - @0x80 - 0xA0
tokenID                        uint256   - @0xA0 - 0xC0
metaData                                 - @0xC0 - END
------------------------------------------------------
metaData length declaration    uint256   - @0xC0 - 0xE0
metaData                       bytes     - @0xE0 - END
```

### executeDeposit

```
function executeDeposit(bytes memory data) public override _onlyBridge
```

`bytes memory data` is laid out as following:
```
destinationChainTokenAddress   address   - @0x20 - 0x40
destinationRecipientAddress    address   - @0x40 - 0x60
tokenID                        uint256   - @0x60 - 0x80
metaData                                 - @0x80 - END
------------------------------------------------------
metaData length declaration    uint256   - @0x80 - 0xA0
metaData                       bytes     - @0xA0 - END
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

`bytes memory data` is laid out as following:
```

destinationRecipientAddress    address   - @0x20 - 0x40
metaData                                 - @0x40 - END
------------------------------------------------------
metaData length declaration    uint256   - @0x40 - 0x60
metaData                       bytes     - @0x60 - END
```

### executeDeposit

Currently unimplemented.




