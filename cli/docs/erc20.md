# ERC20 Command

- [`mint`](#mint)
- [`add-minter`](#add-minter)
- [`approve`](#approve)
- [`deposit`](#deposit)
- [`balance`](#balance)

## `mint`
Mint tokens on an ERC20 mintable contract.

```
  --amount <value>          Amount to mint
  --erc20Address <address>  ERC20 contract address
```
## `add-minter`
Add a minter to an ERC20 mintable contact

```
  --erc20Address <address>  ERC20 contract address
  --minter <address>        Minter address
```
## `approve`
Approve tokens in an ERC20 contract for transfer.

```
  --erc20Address <address>  ERC20 contract address
  --minter <address>        Minter address
```

## `deposit`
Initiate a transfer of ERC20 tokens.

```
  --amount <value>       Amount to transfer
  --dest <id>            Destination chain ID
  --recipient <address>  Destination recipient address
  --resourceId <id>      ResourceID for transfer
  --bridge <address>     Bridge contract address
```

## `balance`
Query balance for an account in an ERC20 contract.

```
  --address <address>       Address to query
  --erc20Address <address>  ERC20 contract address
```
