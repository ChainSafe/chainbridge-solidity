# Admin Command

- [`is-relayer`](#is-relayer)
- [`add-relayer`](#add-relayer)
- [`remove-relayer`](#remove-relayer)
- [`set-threshold`](#set-threshold)
- [`pause`](#pause)
- [`unpause`](#unpause)
- [`set-fee`](#set-fee)
- [`withdraw`](#withdraw)

## `is-relayer`
Check if an address is registered as a relayer.

```
--relayer <value>   Address to check
--bridge <address>  Bridge contract address
```

## `add-relayer`
Adds a new relayer.

```
--relayer <address>  Address of relayer
--bridge <address>   Bridge contract address
```

## `remove-relayer`
Removes a relayer.

```
--relayer <address>  Address of relayer
--bridge <address>   Bridge contract address
```

## `set-threshold`
Sets a new relayer vote threshold.

```
--bridge <address>   Bridge contract address
--threshold <value>  New relayer threshold
```

## `pause`
Pauses deposits and proposals.

```
--bridge <address>  Bridge contract address 
```

## `unpause`
Unpause deposits and proposals.

```
--bridge <address>  Bridge contract address 
```

## `set-fee`
Set a new fee.

```
--bridge <address>  Bridge contract address
--fee <value>       New fee (in wei)
```

## `withdraw`
Withdraw tokens from a handler contract.

```
--bridge <address>         Bridge contract address
--handler <address>        Handler contract address
--tokenContract <address>  ERC20 or ERC721 token contract address
--recipient <address>      Address to withdraw to
--amountOrId <value>       Token ID or amount to withdraw
```