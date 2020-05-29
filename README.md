# chainbridge-solidity

[![Coverage Status](https://coveralls.io/repos/github/ChainSafe/chainbridge-solidity/badge.svg?branch=master)](https://coveralls.io/github/ChainSafe/chainbridge-solidity?branch=master)

ChainBridge uses Solidity smart contracts to enable transfers to and from EVM compatible chains. These contracts consist of a core bridge contract (Bridge.sol) and a set of handler contracts (ERC20Handler.sol, ERC721Handler.sol, and GenericHandler.sol). The bridge contract is responsible for initiating, voting on, and executing proposed transfers. The handlers are used by the bridge contract to interact with other existing contracts.

Read more [here](https://www.notion.so/chainsafe/ChainBridge-Solidity-ad0b0e53e5204e7c8e5e850cbd40392b).

The ChainBridge specification can be found [here](https://github.com/ChainSafe/chainbridge-spec).

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

This is a small CLI application to deploy the contracts and interact with the chain. See the [documentation](/cli/docs/docs.md) for details.


