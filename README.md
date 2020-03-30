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