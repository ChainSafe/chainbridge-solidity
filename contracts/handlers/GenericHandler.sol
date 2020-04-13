pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../interfaces/IDepositHandler.sol";

contract GenericHandler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        uint8   _destinationChainID;
        bytes32 _resourceID;
        address _destinationRecipientAddress;
        address _depositer;
        bytes   _metaData;
    }

    // depositNonce => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

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


    function getDepositRecord(uint256 depositNonce) public view returns (DepositRecord memory) {
        return _depositRecords[depositNonce];
    }

    // make a deposit
    // bytes memory data passed into the function should be constructed as follows:
    //
    // destinationRecipientAddress                address   bytes     0 - 32
    // resourceID                                 bytes32   bytes    32 - 64
    // ----------------------------------------------------------------------------
    // metadata                     length        uint256   bytes    64 - 96
    // metadata                                   bytes     bytes    96 - END
    function deposit(uint8 destinationChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
        address       destinationRecipientAddress;
        bytes32       resourceID;
        bytes memory  metaData;

        assembly {
            // These are all fixed 32 bytes
            // first 32 bytes of bytes is the length
            destinationRecipientAddress    := mload(add(data, 0x20))
            resourceID                     := mload(add(data, 0x40))

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)
            // first 32 bytes of variable length in storage refer to length
            let lenMeta := mload(add(0x60, data))
            mstore(0x40, add(0x60, add(metaData, lenMeta)))

            // in the calldata, metadata is stored @0xC4 after accounting for function signature, and 3 previous params
            calldatacopy(
                metaData,                     // copy to metaData
                0xE4,                        // copy from calldata after data length declaration at 0xC4
                sub(calldatasize(), 0xE4)   // copy size (calldatasize - 0xC4)
            )
        }

        _depositRecords[depositNonce] = DepositRecord(
            destinationChainID,
            resourceID,
            destinationRecipientAddress,
            depositer,
            metaData
        );
    }

    // Todo: Implement example of generic deposit
    function executeDeposit(bytes memory data) public override _onlyBridge {}
}
