// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositExecute.sol";
import "./HandlerHelpers.sol";
import "../ERC1155Safe.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";

contract ERC1155Handler is
    IDepositExecute,
    HandlerHelpers,
    ERC1155Safe,
    ERC1155Holder
{
    using ERC165Checker for address;

    bytes4 private constant _INTERFACE_ERC1155_METADATA = 0x0e89341c;
    bytes private constant EMPTY_BYTES = "";

    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
     */
    constructor(address bridgeAddress) HandlerHelpers(bridgeAddress) {}

    /**
        @notice A deposit is initiatied by making a deposit in the Bridge contract.
        @param resourceID ResourceID used to find address of token to be used for deposit.
        @param depositer Address of account making the deposit in the Bridge contract.
        @param data Consists of ABI-encoded arrays of tokenID and amount.
     */
    function deposit(
        bytes32 resourceID,
        address depositer,
        bytes calldata data
    ) external override onlyBridge returns (bytes memory metaData) {
        uint256 tokenID;
        uint256 amount;

        (tokenID, amount) = abi.decode(data, (uint256, uint256));

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(
            tokenAddress != address(0),
            "provided resourceID does not exist"
        );

        if (_burnList[tokenAddress]) {
            burnERC1155(tokenAddress, depositer, tokenID, amount);
        } else {
            lockERC1155(
                tokenAddress,
                depositer,
                address(this),
                tokenID,
                amount,
                EMPTY_BYTES
            );
        }
    }

    /**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain.
        @param data Consists of ABI-encoded {tokenIDs}, {amounts}, {recipient},
        and {transferData} of types uint[], uint[], bytes, bytes.
     */
    function executeProposal(bytes32 resourceID, bytes calldata data)
        external
        override
        onlyBridge
    {
        uint256 tokenID;
        uint256 amount;
        uint256 lenDestinationRecipientAddress;
        bytes memory destinationRecipientAddress;

        (tokenID, amount, lenDestinationRecipientAddress) = abi.decode(
            data,
            (uint256, uint256, uint256)
        );
        destinationRecipientAddress = bytes(
            data[96:96 + lenDestinationRecipientAddress]
        );

        bytes20 recipientAddress;
        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];

        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
        }

        require(
            _contractWhitelist[address(tokenAddress)],
            "provided tokenAddress is not whitelisted"
        );

        if (_burnList[tokenAddress]) {
            mintERC1155(
                tokenAddress,
                address(recipientAddress),
                tokenID,
                amount
            );
        } else {
            releaseERC1155(
                tokenAddress,
                address(this),
                address(recipientAddress),
                tokenID,
                amount
            );
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
        uint256[] memory tokenIDs;
        uint256[] memory amounts;
        bytes memory transferData;

        (tokenAddress, recipient, tokenIDs, amounts, transferData) = abi.decode(
            data,
            (address, address, uint256[], uint256[], bytes)
        );

        releaseBatchERC1155(
            tokenAddress,
            address(this),
            recipient,
            tokenIDs,
            amounts,
            transferData
        );
    }
}
