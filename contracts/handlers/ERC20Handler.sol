pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../erc/ERC20/ERC20Mintable.sol";
import "../interfaces/IDepositHandler.sol";
import "../interfaces/IBridge.sol";

contract ERC20Handler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint    _destinationChainID;
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

    // depositNonce => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(address bridgeAddress, bytes32[] memory initialResourceIDs, address[] memory initialContractAddresses) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _resourceIDToTokenContractAddress[initialResourceIDs[i]] = initialContractAddresses[i];
            _tokenContractAddressToResourceID[initialContractAddresses[i]] = initialResourceIDs[i];
        }
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function setResourceIDAndContractAddress(bytes32 resourceID, address contractAddress) public {
        require(_resourceIDToTokenContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _tokenContractAddressToResourceID[contractAddress];
        bytes memory emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToResourceID[contractAddress] = resourceID;
    }

    // Make a deposit
    // bytes memory data is laid out as following:
    // originChainTokenAddress     address   - @0x20
    // amount                      uint256   - @0x40
    // destinationRecipientAddress           - @0x60 - END
    function deposit(
        uint256 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        address      originChainTokenAddress;
        bytes memory destinationRecipientAddress;
        uint256      amount;
        uint256      lenDestinationRecipientAddress;

        assembly {
            originChainTokenAddress        := mload(add(data, 0x20))
            amount                         := mload(add(data, 0x40))
            destinationRecipientAddress     := mload(0x40)
            lenDestinationRecipientAddress  := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))

            calldatacopy(
                destinationRecipientAddress, // copy to destinationRecipientAddress
                0xE4,                        // copy from calldata @ 0x104
                sub(calldatasize(), 0xE4)    // copy size (calldatasize - 0x104)
            )
        }


        bytes32      resourceID = _tokenContractAddressToResourceID[originChainTokenAddress];
        bytes memory emptyBytes;

        if (keccak256(abi.encodePacked((resourceID))) == keccak256(abi.encodePacked((emptyBytes)))) {
            // The case where we have never seen this token address before

            // If we have never seen this token and someone was able to perform a deposit,
            // it follows that the token is native to the current chain.

            IBridge bridge = IBridge(_bridgeAddress);
            uint8 chainID = uint8(bridge._chainID());

            resourceID = createResourceID(originChainTokenAddress,chainID);

             _tokenContractAddressToResourceID[originChainTokenAddress] = resourceID;
             _resourceIDToTokenContractAddress[resourceID] = originChainTokenAddress;

        }

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
        bytes memory encodedResourceID = abi.encode(abi.encodePacked(originChainTokenAddress, chainID));
        bytes32 ResourceID;

        assembly {
            ResourceID := mload(add(encodedResourceID, 0x20))
        }

        return ResourceID;
    }

    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256       amount;
        bytes32       resourceID;
        bytes  memory destinationRecipientAddress;


        assembly {
            amount                      := mload(add(data, 0x20))
            resourceID                     := mload(add(data, 0x40))

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
        bytes20 tokenAddress;
        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
            tokenAddress := mload(add(data, 0x4B))
        }


        if (_resourceIDToTokenContractAddress[resourceID] != address(0)) {
            // token exists
            IBridge bridge = IBridge(_bridgeAddress);
            uint256 chainID = bridge._chainID();

            if (uint8(resourceID[31]) == chainID) {
                // token is from same chain
                releaseERC20(address(tokenAddress), address(recipientAddress), amount);
            } else {
                // token is not from chain

                mintERC20(address(tokenAddress), address(recipientAddress), amount);
            }
        } else {
            // Token doesn't exist
            ERC20Mintable erc20 = new ERC20Mintable();
            
            // Create a relationship between the originAddress and the synthetic
            _resourceIDToTokenContractAddress[resourceID] = address(erc20);
            _tokenContractAddressToResourceID[address(erc20)] = resourceID;

            mintERC20(address(erc20), address(recipientAddress), amount);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, recipient, amount);
    }
}
