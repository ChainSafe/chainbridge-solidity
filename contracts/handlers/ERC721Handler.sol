pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositExecute.sol";
import "./HandlerHelpers.sol";
import "../ERC721Safe.sol";
import "../ERC721MinterBurnerPauser.sol";
import "@openzeppelin/contracts/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol";

contract ERC721Handler is IDepositExecute, HandlerHelpers, ERC721Safe {
    using ERC165Checker for address;
    // address public _bridgeAddress;

    bytes4 private constant _INTERFACE_ERC721_METADATA = 0x5b5e139f;

    struct DepositRecord {
        address _tokenAddress;
        uint8   _destinationChainID;
        bytes32 _resourceID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _tokenID;
        bytes   _metaData;
    }

    // DepositID => Deposit Record
    mapping (uint8 => mapping (uint256 => DepositRecord)) public _depositRecords;

    constructor(
        address bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses,
        address[] memory burnableContractAddresses
    ) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResource(initialResourceIDs[i], initialContractAddresses[i]);
        }

        for (uint256 i = 0; i < burnableContractAddresses.length; i++) {
            _setBurnable(burnableContractAddresses[i]);
        }
    }

    function getDepositRecord(uint256 depositID, uint8 destId) public view returns (DepositRecord memory) {
        return _depositRecords[destId][depositID];
    }

    // Make a deposit
    // bytes memory data passed into the function should be constructed as follows:
    //
    // resourceID                                  bytes32    bytes     0 - 32
    // tokenID                                     uint256    bytes    32 - 64
    // --------------------------------------------------------------------------------------------------------------------
    // destinationRecipientAddress     length      uint256    bytes    64 - 96
    // destinationRecipientAddress                   bytes    bytes    96 - (96 + len(destinationRecipientAddress))
    // --------------------------------------------------------------------------------------------------------------------
    function deposit(uint8 destinationChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
        bytes32      resourceID;
        uint         lenDestinationRecipientAddress;
        uint         tokenID;
        bytes memory destinationRecipientAddress;
        bytes memory metaData;

        assembly {

            // Load resourceID from data + 32
            resourceID := mload(add(data, 0x20))
            // Load tokenID from data + 64
            tokenID := mload(add(data, 0x40))

            // Load length of recipient address from data + 96
            lenDestinationRecipientAddress := mload(add(data, 0x60))
            // Load free mem pointer for recipient
            destinationRecipientAddress := mload(0x40)
            // Store recipient address
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))

            // func sig (4) + destinationChainId (padded to 32) + depositNonce (32) + depositor (32) +
            // bytes lenght (32) + resourceId (32) + tokenId (32) + length (32) = 0xE4

            calldatacopy(
                destinationRecipientAddress,    // copy to destinationRecipientAddress
                0xE4,                           // copy from calldata after destinationRecipientAddress length declaration @0xE4
                sub(calldatasize(), 0xE4)       // copy size (calldatasize - (0xE4 + 0x20))
            )
        }

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(_contractWhitelist[tokenAddress], "provided tokenAddress is not whitelisted");

        // Check if the contract supports metadata, fetch it if it does
        if (tokenAddress.supportsInterface(_INTERFACE_ERC721_METADATA)) {
            IERC721Metadata erc721 = IERC721Metadata(tokenAddress);
            metaData = bytes(erc721.tokenURI(tokenID));
        }

        if (_burnList[tokenAddress]) {
            burnERC721(tokenAddress, tokenID);
        } else {
            lockERC721(tokenAddress, depositer, address(this), tokenID);
        }

        _depositRecords[destinationChainID][depositNonce] = DepositRecord(
            tokenAddress,
            uint8(destinationChainID),
            resourceID,
            lenDestinationRecipientAddress,
            destinationRecipientAddress,
            depositer,
            tokenID,
            metaData
        );
    }

    // execute a deposit
    // bytes memory data passed into the function should be constructed as follows:
    //
    // tokenID                                     uint256    bytes     0 - 32
    // resourceID                                  bytes32    bytes    32 - 64
    // --------------------------------------------------------------------------------------------------------------------
    // destinationRecipientAddress     length      uint256    bytes    64 - 96
    // destinationRecipientAddress                   bytes    bytes    96 - (96 + len(destinationRecipientAddress))
    // --------------------------------------------------------------------------------------------------------------------
    // metadata                        length      uint256    bytes    (96 + len(destinationRecipientAddress)) - (96 + len(destinationRecipientAddress) + 32)
    // metadata                                      bytes    bytes    (96 + len(destinationRecipientAddress) + 32) - END
    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256         tokenID;
        bytes32         resourceID;
        bytes  memory   destinationRecipientAddress;
        bytes  memory   metaData;

        assembly {
            tokenID                        := mload(add(data, 0x20))
            resourceID                     := mload(add(data, 0x40))


            // set up destinationRecipientAddress
            destinationRecipientAddress     := mload(0x40)              // load free memory pointer
            let lenDestinationRecipientAddress  := mload(add(data, 0x60))

            // set up metaData
            let lenMeta    := mload(add(data, add(0x80, lenDestinationRecipientAddress)))


            mstore(0x40, add(0x40, add(destinationRecipientAddress, lenDestinationRecipientAddress))) // shift free memory pointer

            calldatacopy(
                destinationRecipientAddress,                             // copy to destinationRecipientAddress
                0x84,                                                    // copy from calldata after destinationRecipientAddress length declaration @0x84
                sub(calldatasize(), add(0x84, add(0x20, lenMeta)))       // copy size (calldatasize - (0xC4 + the space metaData takes up))
            )

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)

            // incrementing free memory pointer
            mstore(0x40, add(0x40, add(metaData, lenMeta)))

            // metadata is located at (0x84 + 0x20 + lenDestinationRecipientAddress) in calldata
            let metaDataLoc := add(0xA4, lenDestinationRecipientAddress)

            // in the calldata, metadata is stored @0x124 after accounting for function signature and the depositNonce
            calldatacopy(
                metaData,                           // copy to metaData
                metaDataLoc,                       // copy from calldata after metaData length declaration
                sub(calldatasize(), metaDataLoc)   // copy size (calldatasize - metaDataLoc)
            )

        }

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

    function withdraw(address tokenAddress, address recipient, uint tokenID) public _onlyBridge {
        releaseERC721(tokenAddress, address(this), recipient, tokenID);
    }
}

