# Bridge Command

- [`register-resource`](#register-resource)
- [`register-generic-resource`](#register-generic-resource)
- [`set-burn`](#set-burn)
- [`query-proposal`](#query-proposal)


## `register-resource`
Register a resource ID with a contract address for a handler.

```
  --bridge <address>          Bridge contract address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --handler <address>         Handler address (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --targetContract <address>  Contract address to be registered (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --resourceId <address>      Resource ID to be registered (default: "0x00000000000000000000003167776db165D8eA0f51790CA2bbf44Db5105ADF00")
```
 
## `register-generic-resource`
Register a resource ID with a contract address for a generic handler.

>Note: The `--hash` flag can be used to avoid computing the function selector ahead of time.

```
  --bridge <address>          Bridge contract address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --handler <address>         Handler contract address (default: "0xd7E33e1bbf65dC001A0Eb1552613106CD7e40C31")
  --targetContract <address>  Contract address to be registered (default: "0xc279648CE5cAa25B9bA753dAb0Dfef44A069BaF4")
  --resourceId <address>      ResourceID to be registered (default: "0x0000000000000000000000c279648CE5cAa25B9bA753dAb0Dfef44A069BaF400")
  --deposit <string>          Function signature of the deposit functions (default: "0x00000000")
  --execute <string>          Function signature of the proposal execution function (default: "0x00000000")
  --hash                      Treat signature inputs as function signature strings, hash and take the first 4 bytes (default: false)
```

## `set-burn`
Set a token contract as mintable/burnable in a handler.

```
  --bridge <address>         Bridge contract address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --handler <address>        ERC20 handler contract address (default: "0x3f709398808af36ADBA86ACC617FeB7F5B7B193E")
  --tokenContract <address>  Token contract to be registered (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```

## `query-proposal`
Query a proposal on-chain.

```
  --bridge <address>        Bridge contract address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
  --depositNonce <address>  Nonce of proposal (default: 0)
  --chainId <id>            Source chain ID of proposal (default: 0)
```


