// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "../interfaces/IDepositExecute.sol";
import "./HandlerHelpers.sol";
import "../ERC1155Safe.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";

contract ERC1155Handler is IDepositExecute, HandlerHelpers, ERC1155Safe, ERC1155Holder {
    using ERC165Checker for address;

    bytes4 private constant _INTERFACE_ERC1155_METADATA = 0x0e89341c;
    bytes private constant EMPTY_BYTES = "";

    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
     */
    constructor(
        address bridgeAddress
    ) HandlerHelpers(bridgeAddress) {
    }

    /**
        @notice A deposit is initiatied by making a deposit in the Bridge contract.
        @param resourceID ResourceID used to find address of token to be used for deposit.
        @param depositer Address of account making the deposit in the Bridge contract.
        @param data Consists of ABI-encoded arrays of tokenIDs and amounts.
     */
    function deposit(bytes32 resourceID, address depositer, bytes calldata data) external override onlyBridge returns (bytes memory metaData) {
        uint[] memory tokenIDs;
        uint[] memory amounts;

        (tokenIDs, amounts) = abi.decode(data, (uint[], uint[]));

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(tokenAddress != address(0), "provided resourceID does not exist");

        if (_burnList[tokenAddress]) {
            burnBatchERC1155(tokenAddress, depositer, tokenIDs, amounts);
        } else {
            lockBatchERC1155(tokenAddress, depositer, address(this), tokenIDs, amounts, EMPTY_BYTES);
        }
    }

    /**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain.
        @param data Consists of ABI-encoded {tokenIDs}, {amounts}, {recipient},
        and {transferData} of types uint[], uint[], bytes, bytes.
     */
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

    /**
        @notice Used to manually release ERC1155 tokens from ERC1155Safe.
        @param data Consists of ABI-encoded {tokenAddress}, {recipient}, {tokenIDs}, 
        {amounts}, and {transferData} of types address, address, uint[], uint[], bytes.
     */
    function withdraw(bytes memory data) external override onlyBridge {
        address tokenAddress;
        address recipient;
        uint[] memory tokenIDs;
        uint[] memory amounts;
        bytes memory transferData;

        (tokenAddress, recipient, tokenIDs, amounts, transferData) = abi.decode(data, (address, address, uint[], uint[], bytes));

        releaseBatchERC1155(tokenAddress, address(this), recipient, tokenIDs, amounts, transferData);
    }
}
