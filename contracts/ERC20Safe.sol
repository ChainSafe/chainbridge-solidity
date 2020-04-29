pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
    @title Manages deposited ERC20s.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
contract ERC20Safe {
    using SafeMath for uint256;

    // ERC20 contract => amount of tokens owned by Safe
    mapping(address => uint256) public _balances;

    // ERC20 contract => amount of tokens burned by Safe
    mapping(address => uint256) public _burnedTokens;

    /**
        @notice Used to transfer tokens into the safe to fund proposals.
        @param tokenAddress Address of ERC20 to transfer.
        @param owner Address of current token owner.
        @param amount Amount of tokens to transfer.
        @notice Increments balance for {tokenAddress}.
     */
    function fundERC20(address tokenAddress, address owner, uint256 amount) public {
        IERC20 erc20 = IERC20(tokenAddress);
        erc20.transferFrom(owner, address(this), amount);

        _balances[tokenAddress] = _balances[tokenAddress].add(amount);
    }

    /**
        @notice Used to gain custoday of deposited token.
        @param tokenAddress Address of ERC20 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer tokens to.
        @param amount Amount of tokens to transfer.
        @notice Increments balance for {tokenAddress}.
     */
    function lockERC20(address tokenAddress, address owner, address recipient, uint256 amount) internal {
        IERC20 erc20 = IERC20(tokenAddress);
        erc20.transferFrom(owner, recipient, amount);

        _balances[tokenAddress] = _balances[tokenAddress].add(amount);
    }

    /**
        @notice Transfers custody of token to recipient.
        @param tokenAddress Address of ERC20 to transfer.
        @param recipient Address to transfer tokens to.
        @param amount Amount of tokens to transfer.
        @notice Decrements balance for {tokenAddress}.
     */
    function releaseERC20(address tokenAddress, address recipient, uint256 amount) internal {
        IERC20 erc20 = IERC20(tokenAddress);
        erc20.transfer(recipient, amount);

        _balances[tokenAddress] = _balances[tokenAddress].sub(amount);
    }

    /**
        @notice Used to create new ERC20s.
        @param tokenAddress Address of ERC20 to transfer.
        @param recipient Address to mint token to.
        @param amount Amount of token to mint.
        @notice Increments balance for {tokenAddress}.
     */
    function mintERC20(address tokenAddress, address recipient, uint256 amount) internal {
        ERC20PresetMinterPauser erc20 = ERC20PresetMinterPauser(tokenAddress);
        erc20.mint(recipient, amount);

        _balances[tokenAddress] = _balances[tokenAddress].add(amount);
    }

    /**
        @notice Used to burn ERC20s.
        @param tokenAddress Address of ERC20 to burn.
        @param owner Current owner of tokens.
        @param amount Amount of tokens to burn.
        @notice Increments {_burnedTokens} balance for {tokenAddress}.
     */
    function burnERC20(address tokenAddress, address owner, uint256 amount) internal {
        ERC20Burnable erc20 = ERC20Burnable(tokenAddress);
        erc20.burnFrom(owner, amount);

        _burnedTokens[tokenAddress] = _burnedTokens[tokenAddress].add(amount);
    }
}
