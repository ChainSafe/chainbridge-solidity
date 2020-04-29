pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IGenericHandler.sol";

contract GenericHandler is IGenericHandler {
    address public _bridgeAddress;

    struct DepositRecord {
        uint8   _destinationChainID;
        bytes32 _resourceID;
        address _depositer;
        bytes   _metaData;
    }

    // depositNonce => Deposit Record
    mapping (uint8 => mapping(uint256 => DepositRecord)) public _depositRecords;

    // resourceID => contract address
    mapping (bytes32 => address) public _resourceIDToContractAddress;

    // contract address => resourceID
    mapping (address => bytes32) public _contractAddressToResourceID;

    // contract address => deposit function signature
    mapping (address => bytes4) public _contractAddressToDepositFunctionSignature;

    // contract address => execute deposit function signature
    mapping (address => bytes4) public _contractAddressToExecuteFunctionSignature;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(
        address          bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses,
        bytes4[]  memory initialDepositFunctionSignatures,
        bytes4[]  memory initialExecuteFunctionSignatures
    ) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        require(initialContractAddresses.length == initialDepositFunctionSignatures.length,
            "mismatch length between provided contract addresses and function signatures");

        require(initialDepositFunctionSignatures.length == initialExecuteFunctionSignatures.length,
            "mismatch length between provided deposit and execute function signatures");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResource(
                initialResourceIDs[i],
                initialContractAddresses[i],
                initialDepositFunctionSignatures[i],
                initialExecuteFunctionSignatures[i]);
        }
    }

    function getDepositRecord(uint256 depositNonce, uint8 destId) public view returns (DepositRecord memory) {
        return _depositRecords[destId][depositNonce];
    }

    function setResource(
        bytes32 resourceID,
        address contractAddress,
        bytes4 depositFunctionSig,
        bytes4 executeFunctionSig
    ) public override {
        require(_resourceIDToContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _contractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResource(resourceID, contractAddress, depositFunctionSig, executeFunctionSig);
    }

    // Initiate a generic deposit. The deposit function associated with the resource ID
    // will be called using data as the parameters, if a function signature exists.
    //
    // resourceID                             bytes32     bytes  0 - 32
    // len(data)                              uint256     bytes  32 - 64
    // data                                   bytes       bytes  96 - END
    function deposit(uint8 destinationChainID, uint256 depositNonce, address depositer, bytes memory data) public _onlyBridge {
        bytes32      resourceID;
        bytes32      lenMetadata;
        bytes memory metadata;

        assembly {
            // Load resource ID from data + 32
            resourceID := mload(add(data, 0x20))
            // Load length of metadata from data + 64
            lenMetadata  := mload(add(data, 0x40))
            // Load free memory pointer
            metadata := mload(0x40)

            mstore(0x40, add(0x20, add(metadata, lenMetadata)))

            // func sig (4) + destinationChainId (padded to 32) + depositNonce (32) + depositor (32) +
            // bytes length (32) + resourceId (32) + length (32) = 0xC4

            calldatacopy(
                metadata, // copy to metadata
                0xC4, // copy from calldata after metadata length declaration @0xC4
                sub(calldatasize(), 0xC4)      // copy size (calldatasize - (0xC4 + the space metaData takes up))
            )
        }

        address contractAddress = _resourceIDToContractAddress[resourceID];
        require(_contractWhitelist[contractAddress], "provided contractAddress is not whitelisted");

        if (_contractAddressToDepositFunctionSignature[contractAddress] != bytes4(0)) {
            (bool success,) = contractAddress.call(metadata);
            require(success, "delegatecall to contractAddress failed");
        }

        _depositRecords[destinationChainID][depositNonce] = DepositRecord(
            destinationChainID,
            resourceID,
            depositer,
            metadata
        );
    }

    // Execute a generic proposal. The The deposit function associated with the resource ID
    // will be called using data as the parameters, if a function signature exists.
    //
    // resourceID                             bytes32     bytes  0 - 32
    // len(data)                              uint256     bytes  32 - 64
    // data                                   bytes       bytes  96 - END
    function executeDeposit(bytes memory data) public  _onlyBridge {
        bytes32      resourceID;
        bytes memory metaData;
        assembly {

            resourceID                     := mload(add(data, 0x20))

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)
            // first 32 bytes of variable length in storage refer to length
            let lenMeta := mload(add(0x40, data))
            mstore(0x40, add(0x60, add(metaData, lenMeta)))

            // in the calldata, metadata is stored @0x64 after accounting for function signature, and 2 previous params
            calldatacopy(
                metaData,                     // copy to metaData
                0x64,                        // copy from calldata after data length declaration at 0x64
                sub(calldatasize(), 0x64)   // copy size (calldatasize - 0x64)
            )
        }

        address contractAddress = _resourceIDToContractAddress[resourceID];
        require(_contractWhitelist[contractAddress], "provided contractAddress is not whitelisted");

        bytes4 sig = _contractAddressToExecuteFunctionSignature[contractAddress];
        if (sig != bytes4(0)) {
            bytes memory callData = abi.encodePacked(sig, metaData);
            (bool success,) = contractAddress.call(callData);
            require(success, "delegatecall to contractAddress failed");
        }
    }

    function _setResource(
        bytes32 resourceID,
        address contractAddress,
        bytes4 depositFunctionSig,
        bytes4 executeFunctionSig
    ) internal {
        _resourceIDToContractAddress[resourceID] = contractAddress;
        _contractAddressToResourceID[contractAddress] = resourceID;
        _contractAddressToDepositFunctionSignature[contractAddress] = depositFunctionSig;
        _contractAddressToExecuteFunctionSignature[contractAddress] = executeFunctionSig;

        _contractWhitelist[contractAddress] = true;
    }
}
