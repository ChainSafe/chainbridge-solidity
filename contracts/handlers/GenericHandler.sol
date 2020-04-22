pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

contract GenericHandler {
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

    // resourceID => contract address
    mapping (bytes32 => address) public _resourceIDToContractAddress;

    // contract address => resourceID
    mapping (address => bytes32) public _contractAddressToResourceID;

    // contract address => function signature
    mapping (address => bytes4) public _contractAddressToFunctionSignature;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    event EMarker(uint mark);
    event EBytes(bytes metaData);
    event EBytes4(bytes4 foo);
    event EBytes32(bytes32 metaData);
    event EAddress(address foo);

    constructor(
        address          bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses,
        bytes4[]  memory initialFunctionSignatures
    ) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        require(initialContractAddresses.length == initialFunctionSignatures.length,
            "mismatch length between provided contract addresses and function signatures");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResourceID(initialResourceIDs[i], initialContractAddresses[i], initialFunctionSignatures[i]);
        }
    }

    function getDepositRecord(uint256 depositNonce) public view returns (DepositRecord memory) {
        return _depositRecords[depositNonce];
    }

    function _setResourceID(bytes32 resourceID, address contractAddress, bytes4 functionSig) internal {
        _resourceIDToContractAddress[resourceID] = contractAddress;
        _contractAddressToResourceID[contractAddress] = resourceID;
        _contractAddressToFunctionSignature[contractAddress] = functionSig;

        _contractWhitelist[contractAddress] = true;
    }

    function setResourceID(bytes32 resourceID, address contractAddress, bytes4 functionSig) public {
        require(_resourceIDToContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _contractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResourceID(resourceID, contractAddress, functionSig);
    }

    function deposit(
        uint8        destinationChainID,
        uint256      depositNonce,
        address      depositer,
        bytes memory data
    ) public _onlyBridge {
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

        address contractAddress = _resourceIDToContractAddress[resourceID];
        require(_contractWhitelist[contractAddress], "provided contractAddress is not whitelisted");

        bytes32 bytes32MetaData = bytesToBytes32(metaData, 0);

        emit EBytes32(bytes32MetaData);
        emit EBytes4(_contractAddressToFunctionSignature[contractAddress]);

        bytes memory callData = abi.encodeWithSelector(_contractAddressToFunctionSignature[contractAddress], bytes32MetaData);
        (bool success, bytes memory returnedData) = contractAddress.call(callData);
        require(success, "delegatecall to contractAddress failed");

        _depositRecords[depositNonce] = DepositRecord(
            destinationChainID,
            resourceID,
            destinationRecipientAddress,
            depositer,
            metaData
        );
    }

    function bytesToBytes32(bytes memory b, uint offset) private pure returns (bytes32) {
        bytes32 out;

        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[offset + i] & 0xFF) >> (i * 8);
        }
        return out;
    }
}
