// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.6.12;

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

    /**
        @notice Used to gain custody of deposited token.
        @param tokenAddress Address of ERC20 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer tokens to.
        @param amount Amount of tokens to transfer.
     */
    function lockERC20(address tokenAddress, address owner, address recipient, uint256 amount) internal {
        IERC20 erc20 = IERC20(tokenAddress);
        _safeTransferFrom(erc20, owner, recipient, amount);
    }

    /**
        @notice Transfers custody of token to recipient.
        @param tokenAddress Address of ERC20 to transfer.
        @param recipient Address to transfer tokens to.
        @param amount Amount of tokens to transfer.
     */
    function releaseERC20(address tokenAddress, address recipient, uint256 amount) internal {
        IERC20 erc20 = IERC20(tokenAddress);
        _safeTransfer(erc20, recipient, amount);
    }

    /**
        @notice Used to create new ERC20s.
        @param tokenAddress Address of ERC20 to transfer.
        @param recipient Address to mint token to.
        @param amount Amount of token to mint.
     */
    function mintERC20(address tokenAddress, address recipient, uint256 amount) internal {
        ERC20PresetMinterPauser erc20 = ERC20PresetMinterPauser(tokenAddress);
        erc20.mint(recipient, amount);

    }

    /**
        @notice Used to burn ERC20s.
        @param tokenAddress Address of ERC20 to burn.
        @param owner Current owner of tokens.
        @param amount Amount of tokens to burn.
     */
    function burnERC20(address tokenAddress, address owner, uint256 amount) internal {
        ERC20Burnable erc20 = ERC20Burnable(tokenAddress);
        erc20.burnFrom(owner, amount);
    }

    /**
        @notice used to transfer ERC20s safely
        @param token Token instance to transfer
        @param to Address to transfer token to
        @param value Amount of token to transfer
     */
    function _safeTransfer(IERC20 token, address to, uint256 value) private {
        _safeCall(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }


    /**
        @notice used to transfer ERC20s safely
        @param token Token instance to transfer
        @param from Address to transfer token from
        @param to Address to transfer token to
        @param value Amount of token to transfer
     */
    function _safeTransferFrom(IERC20 token, address from, address to, uint256 value) private {
        _safeCall(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /**
        @notice used to make calls to ERC20s safely
        @param token Token instance call targets
        @param data encoded call data
     */
    function _safeCall(IERC20 token, bytes memory data) private {        
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "ERC20: call failed");

        if (returndata.length > 0) {

            require(abi.decode(returndata, (bool)), "ERC20: operation did not succeed");
        }
    }

}
