pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../erc/ERC20/ERC20Mintable.sol";
import "../interfaces/IDepositHandler.sol";
import "../interfaces/IBridge.sol";

contract ERC20Handler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;
    bool    public _useContractWhitelist;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint8   _destinationChainID;
        bytes32 _resourceID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    // depositNonce => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(
        address          bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses
        // bool             useContractWhitelist
    ) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        _bridgeAddress = bridgeAddress;
        // we are currently requiring a whitelist
        // _useContractWhitelist = useContractWhitelist;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResourceIDAndContractAddress(initialResourceIDs[i], initialContractAddresses[i]);
        }
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function isWhitelisted(address contractAddress) public view returns (bool) {
        // we are currently requiring a whitelist
        // if (_useContractWhitelist) {
        return _contractWhitelist[contractAddress];
        // }

        // return true;
    }

    function _setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) internal {
        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToResourceID[contractAddress] = resourceID;

        // we are currently requiring a whitelist
        // if (_useContractWhitelist) {
        _contractWhitelist[contractAddress] = true;
        // }
    }

    function setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) public {
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
    // resourceID                             bytes32     bytes   0 - 32
    // amount                                 uint256     bytes  32 - 64
    // destinationRecipientAddress length     uint256     bytes  64 - 96
    // destinationRecipientAddress            bytes       bytes  96 - END
    function deposit(
        uint8 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        // address      originChainTokenAddress;
        bytes32        resourceID;
        bytes   memory destinationRecipientAddress;
        uint256        amount;
        uint256        lenDestinationRecipientAddress;

        assembly {

            resourceID                      := mload(add(data, 0x20))
            // originChainTokenAddress        := mload(add(data, 0x20))
            amount                          := mload(add(data, 0x40))
            destinationRecipientAddress     := mload(0x40)
            lenDestinationRecipientAddress  := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))

            calldatacopy(
                destinationRecipientAddress, // copy to destinationRecipientAddress
                0xE4,                        // copy from calldata @ 0x104
                sub(calldatasize(), 0xE4)    // copy size (calldatasize - 0x104)
            )
        }

        address originChainTokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(isWhitelisted(originChainTokenAddress), "provided originChainTokenAddress is not whitelisted");


        // we are currently only allowing for interactions with whitelisted tokenContracts
        // there should not be a case where we recieve an empty resourceID

        // bytes32      emptyBytes;

        // if (keccak256(abi.encodePacked((resourceID))) == keccak256(abi.encodePacked((emptyBytes)))) {
        //     // The case where we have never seen this token address before

        //     // If we have never seen this token and someone was able to perform a deposit,
        //     // it follows that the token is native to the current chain.

        //     IBridge bridge = IBridge(_bridgeAddress);
        //     uint8 chainID = uint8(bridge._chainID());

        //     resourceID = createResourceID(originChainTokenAddress,chainID);

        //      _tokenContractAddressToResourceID[originChainTokenAddress] = resourceID;
        //      _resourceIDToTokenContractAddress[resourceID] = originChainTokenAddress;

        // }

        lockERC20(originChainTokenAddress, depositer, address(this), amount);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            destinationChainID,
            resourceID,
            lenDestinationRecipientAddress,
            destinationRecipientAddress,
            depositer,
            amount
        );
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


    // execute a deposit
    // bytes memory data passed into the function should be constructed as follows:

    // amount                                 uint256     bytes   0 - 32
    // resourceID                             bytes32     bytes  32 - 64
    // --------------------------------------------------------------------
    // destinationRecipientAddress length     uint256     bytes  64 - 96
    // destinationRecipientAddress            bytes       bytes  96 - END
    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256       amount;
        bytes32       resourceID;
        bytes  memory destinationRecipientAddress;


        assembly {
            amount                      := mload(add(data, 0x20))
            resourceID                  := mload(add(data, 0x40))

            destinationRecipientAddress         := mload(0x40)
            let lenDestinationRecipientAddress  := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))
            
            // in the calldata the destinationRecipientAddress is stored at 0xC4 after accounting for the function signature and length declaration
            calldatacopy(
                destinationRecipientAddress,        // copy to destinationRecipientAddress
                0x84,                               // copy from calldata @ 0x84
                sub(calldatasize(), 0x84)           // copy size to the end of calldata
            )

        }

        bytes20 recipientAddress;
        // bytes20 tokenAddress;
        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];

        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
            // tokenAddress := mload(add(data, 0x4B))
        }

        require(isWhitelisted(tokenAddress), "provided tokenAddress is not whitelisted");

        // if (_resourceIDToTokenContractAddress[resourceID] != address(0)) {
        // token exists
        IBridge bridge = IBridge(_bridgeAddress);
        uint8 chainID = bridge._chainID();

        if (uint8(resourceID[31]) == chainID) {
            // token is from same chain
            releaseERC20(tokenAddress, address(recipientAddress), amount);
        } else {
            // token is not from chain

            mintERC20(tokenAddress, address(recipientAddress), amount);
        }

        // As we are only allowing for interaction with whitelisted contracts, this case no longer exists

        // } else {
        //     // Token doesn't exist
        //     ERC20Mintable erc20 = new ERC20Mintable();
            
        //     // Create a relationship between the originAddress and the synthetic
        //     _resourceIDToTokenContractAddress[resourceID] = address(erc20);
        //     _tokenContractAddressToResourceID[address(erc20)] = resourceID;

        //     mintERC20(address(erc20), address(recipientAddress), amount);
        // }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, recipient, amount);
    }
}
