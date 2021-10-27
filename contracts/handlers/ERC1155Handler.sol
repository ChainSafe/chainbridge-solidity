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

        // Check if the contract supports metadata, fetch it if it does
        if (tokenAddress.supportsInterface(_INTERFACE_ERC1155_METADATA)) {
            IERC1155MetadataURI erc1155 = IERC1155MetadataURI(tokenAddress);
            metaData = bytes(erc1155.uri(tokenIDs[0]));
        }

        if (_burnList[tokenAddress]) {
            burnBatchERC1155(tokenAddress, depositer, tokenIDs, amounts);
        } else {
            lockBatchERC1155(tokenAddress, depositer, address(this), tokenIDs, amounts, data);
        }
    }

    function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
        uint[] memory tokenIDs;
        uint[] memory amounts;
        uint         lenDestinationRecipientAddress;
        bytes memory destinationRecipientAddress;
        uint         offsetMetaData;
        uint         lenMetaData;
        bytes memory metaData;

        (tokenIDs, amounts, lenDestinationRecipientAddress) = abi.decode(data, (uint[], uint[], uint));
        offsetMetaData = 64 + lenDestinationRecipientAddress;
        destinationRecipientAddress = bytes(data[64:offsetMetaData]);
        lenMetaData = abi.decode(data[offsetMetaData:], (uint));
        metaData = bytes(data[offsetMetaData + 32:offsetMetaData + 32 + lenMetaData]);

        bytes20 recipientAddress;

        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
        }

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(_contractWhitelist[address(tokenAddress)], "provided tokenAddress is not whitelisted");

        if (_burnList[tokenAddress]) {
            mintBatchERC1155(tokenAddress, address(recipientAddress), tokenIDs, amounts, metaData);
        } else {
            releaseBatchERC1155(tokenAddress, address(this), address(recipientAddress), tokenIDs, amounts, metaData);
        }
    }

    function withdrawERC1155(address tokenAddress, address recipient, uint[] memory tokenIDs, uint[] memory amounts, bytes memory data) external override onlyBridge {
        releaseBatchERC1155(tokenAddress, address(this), recipient, tokenIDs, amounts, data);
    }
}