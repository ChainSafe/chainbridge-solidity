pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositHandler.sol";

contract GenericHandler is IDepositHandler {
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

    function getDepositRecord(uint256 depositNonce) public view returns (DepositRecord memory) {
        return _depositRecords[depositNonce];
    }

    function setResource(
        bytes32 resourceID,
        address contractAddress,
        bytes4 depositFunctionSig,
        bytes4 executeFunctionSig
    ) public {
        require(_resourceIDToContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _contractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResource(resourceID, contractAddress, depositFunctionSig, executeFunctionSig);
    }

    function deposit(
        uint8        destinationChainID,
        uint256      depositNonce,
        address      depositer,
        bytes memory data
    ) public override _onlyBridge {
        address      destinationRecipientAddress;
        bytes32      resourceID;
        bytes memory metaData;
        bytes4       functionSignature;

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

            functionSignature := mload(add(data, 0x40))
        }

        address contractAddress = _resourceIDToContractAddress[resourceID];
        require(_contractWhitelist[contractAddress], "provided contractAddress is not whitelisted");

        if (_contractAddressToDepositFunctionSignature[contractAddress] != bytes4(0) &&
            _contractAddressToDepositFunctionSignature[contractAddress] == functionSignature) {
            (bool success, bytes memory returnedData) = contractAddress.call(metaData);
            require(success, "delegatecall to contractAddress failed");
        }

        _depositRecords[depositNonce] = DepositRecord(
            destinationChainID,
            resourceID,
            destinationRecipientAddress,
            depositer,
            metaData
        );
    }

    function executeDeposit(bytes memory data) public override  _onlyBridge {
        bytes32      resourceID;
        bytes memory metaData;
        bytes4       functionSignature;
        assembly {
            // These are all fixed 32 bytes
            // first 32 bytes of bytes is the length
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

            functionSignature := mload(add(data, 0x60))
        }

        address contractAddress = _resourceIDToContractAddress[resourceID];
        require(_contractWhitelist[contractAddress], "provided contractAddress is not whitelisted");

        if (_contractAddressToExecuteFunctionSignature[contractAddress] != bytes4(0) &&
            _contractAddressToExecuteFunctionSignature[contractAddress] == functionSignature) {
            (bool success, bytes memory returnedData) = contractAddress.call(metaData);
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
