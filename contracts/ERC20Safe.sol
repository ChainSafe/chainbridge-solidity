pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract ERC20Safe {
    using SafeMath for uint256;

    // ERC20 contract => amount of tokens owned by Safe
    mapping(address => uint256) public _balances;

    // ERC20 contract => amount of tokens burned by Safe
    mapping(address => uint256) public _burnedTokens;

    function fundERC20(address tokenAddress, address owner, uint256 amount) public {
        IERC20 erc20 = IERC20(tokenAddress);
        erc20.transferFrom(owner, address(this), amount);

        _balances[tokenAddress] = _balances[tokenAddress].add(amount);
    }

    function lockERC20(address tokenAddress, address owner, address recipient, uint256 amount) internal {
        IERC20 erc20 = IERC20(tokenAddress);
        erc20.transferFrom(owner, recipient, amount);

        _balances[tokenAddress] = _balances[tokenAddress].add(amount);
    }

    function releaseERC20(address tokenAddress, address recipient, uint256 amount) internal {
        IERC20 erc20 = IERC20(tokenAddress);
        erc20.transfer(recipient, amount);

        _balances[tokenAddress] = _balances[tokenAddress].sub(amount);
    }

    function mintERC20(address tokenAddress, address recipient, uint256 amount) internal {
        ERC20PresetMinterPauser erc20 = ERC20PresetMinterPauser(tokenAddress);
        erc20.mint(recipient, amount);

        _balances[tokenAddress] = _balances[tokenAddress].add(amount);
    }

    function burnERC20(address tokenAddress, address owner, uint256 amount) internal {
        ERC20Burnable erc20 = ERC20Burnable(tokenAddress);
        erc20.burnFrom(owner, amount);

        _burnedTokens[tokenAddress] = _burnedTokens[tokenAddress].add(amount);
    }
}