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
originChainTokenAddress     address   - @0x20 - 0x40
destinationRecipientAddress address   - @0x40 - 0x60
amount                      uint256   - @0x60 - 0x80 (END)
```

### executeDeposit

```
function executeDeposit(bytes memory data) public override _onlyBridge
```
`bytes memory data` is laid out as following (since we know `len(tokenID) = 64`):

```
destinationRecipientAddress address   - @0x20 - 0x40
amount                      uint256   - @0x40 - 0x60
tokenID                               - @0x60 - END

------------------------------------------------------
tokenID length declaration  uint256   - @0x60 - 0x80
tokenID                     bytes     - @0x80 - 0xC0
------------------------------------------------------

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




