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

### JS CLI

#### deploy

Deploy contracts with configurable constructor args. Relayers will be added from default keys (max 5).
```
./scripts/cli/index.js deploy --port <port> --validator-threshold <n> --relayers <n>
```

#### mint

Mint default erc20 tokens.
```
./scripts/cli/index.js mint --port <port> --value <n>
```

#### transfer

Initiate a transfer of erc20 to some destination chain.
```
./scripts/cli/index.js transfer --port <port> --value <n> --dest <n>
```