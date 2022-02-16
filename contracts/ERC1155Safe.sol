// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";

/**
    @title Manages deposited ERC1155s.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with ERC1155Handler contract.
 */
contract ERC1155Safe {
    using SafeMath for uint256;

    /**
        @notice Used to gain custoday of deposited token with batching.
        @param tokenAddress Address of ERC1155 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer token to.
        @param tokenIDs IDs of tokens to transfer.
        @param amounts Amounts of tokens to transfer.
        @param data Additional data.
     */
    function lockBatchERC1155(address tokenAddress, address owner, address recipient, uint[] memory tokenIDs, uint[] memory amounts, bytes memory data) internal {
        IERC1155 erc1155 = IERC1155(tokenAddress);
        erc1155.safeBatchTransferFrom(owner, recipient, tokenIDs, amounts, data);
    }

    /**
        @notice Transfers custody of token to recipient with batching.
        @param tokenAddress Address of ERC1155 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer token to.
        @param tokenIDs IDs of tokens to transfer.
        @param amounts Amounts of tokens to transfer.
        @param data Additional data.
     */
    function releaseBatchERC1155(address tokenAddress, address owner, address recipient, uint256[] memory tokenIDs, uint[] memory amounts, bytes memory data) internal {
        IERC1155 erc1155 = IERC1155(tokenAddress);
        erc1155.safeBatchTransferFrom(owner, recipient, tokenIDs, amounts, data);
    }

    /**
        @notice Used to create new ERC1155s with batching.
        @param tokenAddress Address of ERC1155 to mint.
        @param recipient Address to mint token to.
        @param tokenIDs IDs of tokens to mint.
        @param amounts Amounts of token to mint.
        @param data Additional data.
     */
    function mintBatchERC1155(address tokenAddress, address recipient, uint[] memory tokenIDs, uint[] memory amounts, bytes memory data) internal {
        ERC1155PresetMinterPauser erc1155 = ERC1155PresetMinterPauser(tokenAddress);
        erc1155.mintBatch(recipient, tokenIDs, amounts, data);
    }

    /**
        @notice Used to burn ERC1155s with batching.
        @param tokenAddress Address of ERC1155 to burn.
        @param tokenIDs IDs of tokens to burn.
        @param amounts Amounts of tokens to burn.
     */
    function burnBatchERC1155(address tokenAddress, address owner, uint[] memory tokenIDs, uint[] memory amounts) internal {
        ERC1155Burnable erc1155 = ERC1155Burnable(tokenAddress);
        erc1155.burnBatch(owner, tokenIDs, amounts);
    }
}
