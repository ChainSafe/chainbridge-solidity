pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract NativeAssetSafe {
    using SafeMath for uint256;

    uint256 public _balance;

    /**
        @notice Used to transfer Asset into the safe to fund proposals.
        @notice Increments balance for {tokenAddress}.
     */
    function fundAsset() public payable {
        require(msg.value > 0, "cannot fund zero");
        _balance = _balance.add(amount);
    }

    /**
        @notice Used to gain custoday of deposited token.
        @param amount Amount of tokens to transfer.
        @notice Increments balance for {tokenAddress}.
     */
    function lockAsset(uint256 amount) internal {
        _balance = _balance.add(amount);
    }

    /**
        @notice Transfers custody of token to recipient.
        @param recipient Address to transfer tokens to.
        @param amount Amount of tokens to transfer.
        @notice Decrements balance for {tokenAddress}.
     */
    function releaseAsset(address recipient, uint256 amount) internal {
        _balance = _balance.sub(amount);
        recipient.trasnfer(amount);
    }

    /**
        @notice Used to burn Assets.
        @param tokenAddress Address of Asset to burn.
        @param owner Current owner of tokens.
        @param amount Amount of tokens to burn.
        @notice Increments {_burnedTokens} balance for {tokenAddress}.
     */
    function burnAsset(address tokenAddress, address owner, uint256 amount) internal {
        AssetBurnable erc20 = AssetBurnable(tokenAddress);
        erc20.burnFrom(owner, amount);

        _burnedTokens[tokenAddress] = _burnedTokens[tokenAddress].add(amount);
    }
}
