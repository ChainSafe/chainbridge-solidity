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
        bytes   _tokenID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // tokenID => token contract address
    mapping (bytes => address) public _tokenIDToTokenContractAddress;

    // token contract address => tokenID
    mapping (address => bytes) public _tokenContractAddressToTokenID;

    // DepositID => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(address bridgeAddress, bytes[] memory initialTokenIDs, address[] memory initialContractAddresses) public {
        require(initialTokenIDs.length == initialContractAddresses.length,
            "mismatch length between initialTokenIDs and initialContractAddresses");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialTokenIDs.length; i++) {
            _tokenIDToTokenContractAddress[initialTokenIDs[i]] = initialContractAddresses[i];
            _tokenContractAddressToTokenID[initialContractAddresses[i]] = initialTokenIDs[i];
        }
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function setTokenIDAndContractAddress(bytes memory tokenID, address contractAddress) public {
        require(_tokenIDToTokenContractAddress[tokenID] == address(0), "tokenID already has a corresponding contract address");

        bytes memory currentTokenID = _tokenContractAddressToTokenID[contractAddress];
        bytes memory emptyBytes;
        require(keccak256(abi.encodePacked((currentTokenID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding tokenID");

        _tokenIDToTokenContractAddress[tokenID] = contractAddress;
        _tokenContractAddressToTokenID[contractAddress] = tokenID;
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


        bytes memory tokenID = _tokenContractAddressToTokenID[originChainTokenAddress];
        bytes memory emptyBytes;

        if (keccak256(abi.encodePacked((tokenID))) == keccak256(abi.encodePacked((emptyBytes)))) {
            // The case where we have never seen this token address before

            // If we have never seen this token and someone was able to perform a deposit,
            // it follows that the token is native to the current chain.

            IBridge bridge = IBridge(_bridgeAddress);
            uint chainID = bridge._chainID();

            tokenID = createTokenID(chainID, originChainTokenAddress);

             _tokenContractAddressToTokenID[originChainTokenAddress] = tokenID;
             _tokenIDToTokenContractAddress[tokenID] = originChainTokenAddress;

        }

        lockERC20(originChainTokenAddress, depositer, address(this), amount);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            destinationChainID,
            tokenID,
            lenDestinationRecipientAddress,
            destinationRecipientAddress,
            depositer,
            amount
        );
    }

    function createTokenID(uint256 chainID, address originChainTokenAddress) internal pure returns (bytes memory) {
        return abi.encode(chainID, originChainTokenAddress);
    }

    // execute a deposit
    // bytes memory data is laid out as following:
    // amount                      uint256   - @0x20 - 0x40
    // tokenID                               - @0x40 - 0xC0
    // -----------------------------------------------------
    // tokenID len                 uint256   - @0x40 - 0x60
    // tokenID                     bytes     - @0x60 - 0xA0
    // -----------------------------------------------------
    // destinationRecipientAddress           - @0xA0 - END
    // -----------------------------------------------------
    // destinationRecipientAddress len uint256 - @0xA0 - 0xC0
    // destinationRecipientAddress     bytes   - @0xC0 - END
    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256       amount;
        bytes  memory tokenID;
        bytes  memory destinationRecipientAddress;
        uint256 tokenChainID;
        address tokenAddress;


        assembly {
            amount                      := mload(add(data, 0x20))
            tokenChainID                := mload(add(data, 0x60))
            tokenAddress                := mload(add(data, 0x80))

            destinationRecipientAddress         := mload(0x40)
            let lenDestinationRecipientAddress  := mload(add(0xA0, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))
            
            // in the calldata the destinationRecipientAddress is stored at 0xC4 after accounting for the function signature and length declaration
            calldatacopy(
                destinationRecipientAddress,        // copy to destinationRecipientAddress
                0xC4,                               // copy from calldata @ 0x84
                sub(calldatasize(), 0xC4)           // copy size to the end of calldata
            )

        }

        tokenID = abi.encode(tokenChainID, tokenAddress);

        bytes20 recipientAddress;
        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
        }


        if (_tokenIDToTokenContractAddress[tokenID] != address(0)) {
            // token exists
            IBridge bridge = IBridge(_bridgeAddress);
            uint256 chainID = bridge._chainID();

            if (tokenChainID == chainID) {
                // token is from same chain
                releaseERC20(tokenAddress, address(recipientAddress), amount);
            } else {
                // token is not from chain
                mintERC20(tokenAddress, address(recipientAddress), amount);
            }
        } else {
            // Token doesn't exist
            ERC20Mintable erc20 = new ERC20Mintable();
            
            // Create a relationship between the originAddress and the synthetic
            _tokenIDToTokenContractAddress[tokenID] = address(erc20);
            _tokenContractAddressToTokenID[address(erc20)] = tokenID;

            mintERC20(address(erc20), address(recipientAddress), amount);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, recipient, amount);
    }
}
