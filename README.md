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

# data layout

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
`bytes memory data` is laid out as following:

```
destinationRecipientAddress address   - @0x20 - 0x40
amount                      uint256   - @0x40 - 0x60
tokenID                               - @0x60 - END
------------------------------------------------------
tokenID length declaration  uint256   - @0x60 - 0x80
tokenID                     string    - @0x80 - END
```


### tokenID

`tokenID` is a utf-8 encodable `string` identifier of a particular token. It is laid out as following:

string(chainID) + string(originChainTokenAddress)

Encoded it should be laid out like this:

```
tokenID length declaration  uint256   - @0x00 - 0x20
tokenID                     string    - @0x20 - END
```


