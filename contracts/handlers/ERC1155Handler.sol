// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositExecute.sol";
import "./HandlerHelpers.sol";
import "../ERC1155Safe.sol";
import "@openzeppelin/contracts/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";

contract ERC1155Handler is IDepositExecute, HandlerHelpers, ERC1155Safe, ERC1155Holder {
    using ERC165Checker for address;

    bytes4 private constant _INTERFACE_ERC1155_METADATA = 0x0e89341c;
    bytes private constant EMPTY_BYTES = "";

    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
     */
    constructor(
        address bridgeAddress
    ) public HandlerHelpers(bridgeAddress) {
    }

    /**
        @notice A deposit is initiatied by making a deposit in the Bridge contract.
        @param resourceID ResourceID used to find address of token to be used for deposit.
        @param depositer Address of account making the deposit in the Bridge contract.
        @param data Consists of tokenIDs array and amounts array padded to 32 bytes.
     */
    function deposit(bytes32 resourceID, address depositer, bytes calldata data) external override onlyBridge returns (bytes memory metaData) {
        uint[] memory tokenIDs;
        uint[] memory amounts;

        (tokenIDs, amounts) = abi.decode(data, (uint[], uint[]));

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(_contractWhitelist[tokenAddress], "provided tokenAddress is not whitelisted");

        if (_burnList[tokenAddress]) {
            burnBatchERC1155(tokenAddress, depositer, tokenIDs, amounts);
        } else {
            lockBatchERC1155(tokenAddress, depositer, address(this), tokenIDs, amounts, EMPTY_BYTES);
        }
    }

    function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
        uint[] memory tokenIDs;
        uint[] memory amounts;
        bytes memory recipient;
        bytes memory transferData;

        (tokenIDs, amounts, recipient, transferData) = abi.decode(data, (uint[], uint[], bytes, bytes));

        bytes20 recipientAddress;

        assembly {
            recipientAddress := mload(add(recipient, 0x20))
        }

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(_contractWhitelist[address(tokenAddress)], "provided tokenAddress is not whitelisted");

        if (_burnList[tokenAddress]) {
            mintBatchERC1155(tokenAddress, address(recipientAddress), tokenIDs, amounts, transferData);
        } else {
            releaseBatchERC1155(tokenAddress, address(this), address(recipientAddress), tokenIDs, amounts, transferData);
        }
    }

    function genericWithdraw(bytes memory data) external override onlyBridge {
        address tokenAddress;
        uint[] memory tokenIDs;
        uint[] memory amounts;
        bytes memory recipient;
        bytes memory transferData;

        (tokenAddress, tokenIDs, amounts, recipient, transferData) = abi.decode(data, (address, uint[], uint[], bytes, bytes));

        bytes20 recipientAddress;

        assembly {
            recipientAddress := mload(add(recipient, 0x20))
        }

        releaseBatchERC1155(tokenAddress, address(this), address(recipientAddress), tokenIDs, amounts, data);
    }
}