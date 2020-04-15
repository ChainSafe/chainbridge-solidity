pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositHandler.sol";
import "../interfaces/IBridge.sol";

contract CentrifugeAssetHandler is IDepositHandler {
    address public _bridgeAddress;

    struct DepositRecord {
        address originChainContractAddress;
        uint8 destinationChainID;
        bytes32 resourceID;
        address destinationRecipientAddress;
        address depositer;
        bytes32 metaDataHash;
    }

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

    // depositID => DepositRecord
    mapping(uint256 => DepositRecord) _depositRecords;
    // metaDataHash => AssetDepositStatus
    mapping(bytes32 => bool) _assetDepositStatuses;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(
        address bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses
        
    ) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResourceIDAndContractAddress(initialResourceIDs[i], initialContractAddresses[i]);
        }
    }

    function isWhitelisted(address contractAddress) internal view returns (bool) {
        return _contractWhitelist[contractAddress];
    }

    function _setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) internal {
        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToResourceID[contractAddress] = resourceID;

        _contractWhitelist[contractAddress] = true;
    }

    function setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) public {
        require(_resourceIDToTokenContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _tokenContractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResourceIDAndContractAddress(resourceID, contractAddress);
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function getHash(bytes32 hash) public view returns (bool) {
        return _assetDepositStatuses[hash];
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

    // make a deposit
    // bytes memory data passed into the function should be constructed as follows:

    // originChainContractAddress                 address   bytes     0 - 32
    // destinationRecipientAddress                bytes32   bytes    32 - 64
    // metadataHash                               bytes     bytes    64 - 96
    function deposit(uint8 originChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
        // address originChainContractAddress;
        bytes32 resourceID;
        address destinationRecipientAddress;
        bytes32 metaDataHash;

        assembly {
            // originChainContractAddress     := mload(add(data,0x20))
            resourceID                     := mload(add(data,0x20))
            destinationRecipientAddress    := mload(add(data,0x40))
            metaDataHash                   := mload(add(data,0x60))
        }

        address originChainContractAddress = _resourceIDToTokenContractAddress[resourceID];
        require(isWhitelisted(originChainContractAddress), "provided originChainContractAddress is not whitelisted");

        // we are currently only allowing for interactions with whitelisted tokenContracts
        // there should not be a case where we recieve an empty resourceID

        // bytes32      resourceID = _tokenContractAddressToResourceID[originChainContractAddress];
        // bytes32      emptyBytes;

        // if (keccak256(abi.encodePacked((resourceID))) == keccak256(abi.encodePacked((emptyBytes)))) {
        //     // The case where we have never seen this token address before

        //     // If we have never seen this token and someone was able to perform a deposit,
        //     // it follows that the token is native to the current chain.

        //     IBridge bridge = IBridge(_bridgeAddress);
        //     uint8 chainID = uint8(bridge._chainID());

        //     resourceID = createResourceID(originChainContractAddress,chainID);

        //      _tokenContractAddressToResourceID[originChainContractAddress] = resourceID;
        //      _resourceIDToTokenContractAddress[resourceID] = originChainContractAddress;

        // }

        require(_assetDepositStatuses[metaDataHash] == false,
        "asset has already been deposited and cannot be changed");

        _depositRecords[depositNonce] = DepositRecord(
            originChainContractAddress,
            originChainID,
            resourceID,
            destinationRecipientAddress,
            depositer,
            metaDataHash
        );
    }

    // execute a deposit
    // bytes memory data passed into the function should be constructed as follows:

    // metadataHash                               bytes     bytes    0 - 32
    function executeDeposit(bytes memory data) public override _onlyBridge {
        bytes32 resourceID;
        bytes32 metaDataHash;

        assembly {
            resourceID := mload(add(data, 0x20))
            metaDataHash := mload(add(data, 0x40))
        }

        require(isWhitelisted(address(_resourceIDToTokenContractAddress[resourceID])), "provided tokenAddress is not whitelisted");


        // bytes20 originChainContractAddress;

        // assembly {
        //     originChainContractAddress := mload(add(data, 0x2B))
        // }

        // doesn't matter if we know the origin chain contract address or not
        // leaving this comment here in the case that we need to change the logic


        require(_assetDepositStatuses[metaDataHash] == false, "asset has been deposited!");
        _assetDepositStatuses[metaDataHash] = true;
    }
}
