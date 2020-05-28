# ERC20 Command

- [`mint`](#mint)
- [`add-minter`](#add-minter)
- [`approve`](#approve)
- [`deposit`](#deposit)
- [`balance`](#balance)

## `mint`
Mint tokens on an ERC20 mintable contract.

```
  --amount <value>          Amount to mint (default: 100)
  --erc20Address <address>  ERC20 contract address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```
## `add-minter`
Add a minter to an ERC20 mintable contact

```
  --erc20Address <address>  ERC20 contract address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --minter <address>        Minter address (default: "0x8e0a907331554AF72563Bd8D43051C2E64Be5d35")
```
## `approve`
Approve tokens in an ERC20 contract for transfer.

```
  --erc20Address <address>  ERC20 contract address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
  --minter <address>        Minter address (default: "0x8e0a907331554AF72563Bd8D43051C2E64Be5d35")
```

## `deposit`
Initiate a transfer of ERC20 tokens.

```
  --amount <value>       Amount to transfer (default: 1)
  --dest <id>            Destination chain ID (default: 1)
  --recipient <address>  Destination recipient address (default: "0x4CEEf6139f00F9F4535Ad19640Ff7A0137708485")
  --resourceId <id>      ResourceID for transfer (default: "0x00000000000000000000003167776db165D8eA0f51790CA2bbf44Db5105ADF00")
  --bridge <address>     Bridge contract address (default: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B")
```

## `balance`
Query balance for an account in an ERC20 contract.

```
  --address <address>       Address to query (default: "0xff93B45308FD417dF303D6515aB04D9e89a750Ca")
  --erc20Address <address>  ERC20 contract address (default: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF")
```
