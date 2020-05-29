# Bridge Command

- [`register-resource`](#register-resource)
- [`register-generic-resource`](#register-generic-resource)
- [`set-burn`](#set-burn)
- [`query-proposal`](#query-proposal)
- [`cancel-proposal`](#cancel-proposal)


## `register-resource`
Register a resource ID with a contract address for a handler.

```
  --bridge <address>          Bridge contract address
  --handler <address>         Handler address
  --targetContract <address>  Contract address to be registered
  --resourceId <address>      Resource ID to be registered
```
 
## `register-generic-resource`
Register a resource ID with a contract address for a generic handler.

>Note: The `--hash` flag can be used to avoid computing the function selector ahead of time.

```
  --bridge <address>          Bridge contract address
  --handler <address>         Handler contract address
  --targetContract <address>  Contract address to be registered
  --resourceId <address>      ResourceID to be registered
  --deposit <string>          Function signature of the deposit functions
  --execute <string>          Function signature of the proposal execution function
  --hash                      Treat signature inputs as function signature strings, hash and take the first 4 bytes 
```

## `set-burn`
Set a token contract as mintable/burnable in a handler.

```
  --bridge <address>         Bridge contract address
  --handler <address>        ERC20 handler contract address
  --tokenContract <address>  Token contract to be registered
```

## `query-proposal`
Query a proposal on-chain.

```
  --bridge <address>        Bridge contract address
  --depositNonce <address>  Nonce of proposal
  --chainId <id>            Source chain ID of proposal
```

## `cancel-proposal`
Cancels an expired proposal.

```
  --bridge <address>      Bridge contract address
  --chainId <id>          Chain ID of proposal to cancel
  --depositNonce <value>  Deposit nonce of proposal to cancel
```