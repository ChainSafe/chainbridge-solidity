// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositExecute.sol";
import "./HandlerHelpers.sol";
import "../ERC721Safe.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";


/**
    @title Handles ERC721 deposits and deposit executions.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract.
 */
contract ERC721Handler is IDepositExecute, HandlerHelpers, ERC721Safe {
    using ERC165Checker for address;

    bytes4 private constant _INTERFACE_ERC721_METADATA = 0x5b5e139f;

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
        @param data Consists of {tokenID} padded to 32 bytes.
        @notice Data passed into the function should be constructed as follows:
        tokenID                                     uint256    bytes    0  - 32
        @notice If the corresponding {tokenAddress} for the parsed {resourceID} supports {_INTERFACE_ERC721_METADATA},
        then {metaData} will be set according to the {tokenURI} method in the token contract.
        @dev Depending if the corresponding {tokenAddress} for the parsed {resourceID} is
        marked true in {_burnList}, deposited tokens will be burned, if not, they will be locked.
        @return metaData : the deposited token metadata acquired by calling a {tokenURI} method in the token contract.
     */
    function deposit(bytes32    resourceID,
                    address     depositer,
                    bytes       calldata data
                    ) external override onlyBridge returns (bytes memory metaData) {
        uint         tokenID;

        (tokenID) = abi.decode(data, (uint));

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(_contractWhitelist[tokenAddress], "provided tokenAddress is not whitelisted");

        // Check if the contract supports metadata, fetch it if it does
        if (tokenAddress.supportsInterface(_INTERFACE_ERC721_METADATA)) {
            IERC721Metadata erc721 = IERC721Metadata(tokenAddress);
            metaData = bytes(erc721.tokenURI(tokenID));
        }

        if (_burnList[tokenAddress]) {
            burnERC721(tokenAddress, depositer, tokenID);
        } else {
            lockERC721(tokenAddress, depositer, address(this), tokenID);
        }
    }

    /**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain.
        @param data Consists of {tokenID}, {resourceID}, {lenDestinationRecipientAddress},
        {destinationRecipientAddress}, {lenMeta}, and {metaData} all padded to 32 bytes.
        @notice Data passed into the function should be constructed as follows:
        tokenID                                     uint256    bytes    0  - 32
        destinationRecipientAddress     length      uint256    bytes    32 - 64
        destinationRecipientAddress                   bytes    bytes    64 - (64 + len(destinationRecipientAddress))
        metadata                        length      uint256    bytes    (64 + len(destinationRecipientAddress)) - (64 + len(destinationRecipientAddress) + 32)
        metadata                                      bytes    bytes    (64 + len(destinationRecipientAddress) + 32) - END
     */
    function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
        uint         tokenID;
        uint         lenDestinationRecipientAddress;
        bytes memory destinationRecipientAddress;
        uint         offsetMetaData;
        uint         lenMetaData;
        bytes memory metaData;

        (tokenID, lenDestinationRecipientAddress) = abi.decode(data, (uint, uint));
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
            mintERC721(tokenAddress, address(recipientAddress), tokenID, metaData);
        } else {
            releaseERC721(tokenAddress, address(this), address(recipientAddress), tokenID);
        }
    }

    /**
        @notice Used to manually release ERC721 tokens from ERC721Safe.
        @param data Consists of {tokenAddress}, {recipient}, and {tokenID} all padded to 32 bytes.
        @notice Data passed into the function should be constructed as follows:
        tokenAddress                           address     bytes  0 - 32
        recipient                              address     bytes  32 - 64
        tokenID                                uint        bytes  64 - 96
     */
    function withdraw(bytes memory data) external override onlyBridge {
        address tokenAddress;
        address recipient;
        uint tokenID;

        (tokenAddress, recipient, tokenID) = abi.decode(data, (address, address, uint));

        releaseERC721(tokenAddress, address(this), recipient, tokenID);
    }
}
