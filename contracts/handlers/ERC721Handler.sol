pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC721Safe.sol";
import "../interfaces/IDepositHandler.sol";
import "../ERC721MinterBurnerPauser.sol";
import "../interfaces/IMinterBurner.sol";
import "@openzeppelin/contracts/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol";

contract ERC721Handler is IDepositHandler, IMinterBurner, ERC721Safe {
    using ERC165Checker for address;
    address public _bridgeAddress;

    bytes4 private constant _INTERFACE_ERC721_METADATA = 0x5b5e139f;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint8   _destinationChainID;
        bytes32 _resourceID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _tokenID;
        bytes   _metaData;
    }

    // DepositID => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    // token contract address => is burnable
    mapping (address => bool) public _burnList;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

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
            _setResourceIDAndContractAddress(initialResourceIDs[i], initialContractAddresses[i]);
        }

        for (uint256 i = 0; i < burnableContractAddresses.length; i++) {
            _setBurnable(burnableContractAddresses[i]);
        }
    }

    function isWhitelisted(address contractAddress) internal view returns (bool) {
        return _contractWhitelist[contractAddress];
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function setBurnable(address contractAddress) public override _onlyBridge{
        _setBurnable(contractAddress);
    }

    function _setBurnable(address contractAddress) internal {
        require(isWhitelisted(contractAddress), "provided contract is not whitelisted");
        _burnList[contractAddress] = true;
    }

    function createResourceID (address originChainTokenAddress, uint8 chainID) internal pure returns (bytes32) {
        bytes11 padding;
        bytes memory encodedResourceID = abi.encodePacked(padding, abi.encodePacked(originChainTokenAddress, chainID));
        bytes32 resourceID;

        assembly {
            resourceID := mload(add(encodedResourceID, 0x20))
        }

        return resourceID;
    }

    function _setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) internal {
        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToResourceID[contractAddress] = resourceID;

        _contractWhitelist[contractAddress] = true;
    }

    function setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) public override _onlyBridge {
        require(_resourceIDToTokenContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _tokenContractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResourceIDAndContractAddress(resourceID, contractAddress);
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

        address originChainTokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(isWhitelisted(originChainTokenAddress), "provided originChainTokenAddress is not whitelisted");

        // we are currently only allowing for interactions with whitelisted tokenContracts
        // there should not be a case where we recieve an empty resourceID

        // bytes32 resourceID = _tokenContractAddressToResourceID[originChainTokenAddress];
        // bytes memory emptyBytes;

        // if (keccak256(abi.encodePacked((resourceID))) == keccak256(abi.encodePacked((emptyBytes)))) {
        //     // The case where we have never seen this token address before

        //     // If we have never seen this token and someone was able to perform a deposit,
        //     // it follows that the token is native to the current chain.

        //     IBridge bridge = IBridge(_bridgeAddress);
        //     uint8 chainID = bridge._chainID();

        //     resourceID = createResourceID(originChainTokenAddress, chainID);

        //      _tokenContractAddressToResourceID[originChainTokenAddress] = resourceID;
        //      _resourceIDToTokenContractAddress[resourceID] = originChainTokenAddress;

        // }

        // Check if the contract supports metadata, fetch it if it does
        if (originChainTokenAddress.supportsInterface(_INTERFACE_ERC721_METADATA)) {
            IERC721Metadata erc721 = IERC721Metadata(originChainTokenAddress);
            metaData = bytes(erc721.tokenURI(tokenID));
        }

        if (_burnList[originChainTokenAddress]) {
            burnERC721(originChainTokenAddress, tokenID);
        } else {
            lockERC721(originChainTokenAddress, depositer, address(this), tokenID);
        }

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
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
        require(isWhitelisted(address(tokenAddress)), "provided tokenAddress is not whitelisted");


        // if (_resourceIDToTokenContractAddress[resourceID] != address(0)) {
        // token exists

        if (_burnList[tokenAddress]) {
            mintERC721(tokenAddress, address(recipientAddress), tokenID, metaData);
        } else {
            releaseERC721(tokenAddress, address(this), address(recipientAddress), tokenID);
        }

        // As we are only allowing for interaction with whitelisted contracts, this case no longer exists

        // } else {
        //     // Token doesn't exist
        //     ERC721Mintable erc721 = new ERC721Mintable();

        //     // Create a relationship between the originAddress and the synthetic
        //     _resourceIDToTokenContractAddress[resourceID] = address(erc721);
        //     _tokenContractAddressToResourceID[address(erc721)] = resourceID;

        //     erc721.safeMint(address(recipientAddress), tokenID, metaData);
        // }
    }

    function withdraw(address tokenAddress, address recipient, uint tokenID) public _onlyBridge {
        releaseERC721(tokenAddress, address(this), recipient, tokenID);
    }
}

