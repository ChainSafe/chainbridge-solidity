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
        bytes  _tokenID;
        address _destinationRecipientAddress;
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

    constructor(address bridgeAddress) public {
        _bridgeAddress = bridgeAddress;
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }


    // Make a deposit
    // bytes memory data is laid out as following:
    // originChainTokenAddress     address   - @0x20
    // destinationRecipientAddress address   - @0x40
    // amount                      uint256   - @0x60
    function deposit(
        uint256 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        address originChainTokenAddress;
        address destinationRecipientAddress;
        uint256 amount;

        assembly {
            originChainTokenAddress        := mload(add(data, 0x20))
            destinationRecipientAddress    := mload(add(data, 0x40))
            amount                         := mload(add(data, 0x60))
        }

        bytes memory tokenID = _tokenContractAddressToTokenID[originChainTokenAddress];

        if (keccak256(abi.encodePacked(tokenID)) == keccak256(abi.encodePacked(""))) {
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
    // destinationRecipientAddress address   - @0x20 - 0x40
    // amount                      uint256   - @0x40 - 0x60
    // tokenID                               - @0x60 - END
    // tokenID length declaration  uint256   - @0x60 - 0x80
    // tokenID                     bytes     - @0x80 - END
    function executeDeposit(bytes memory data) public override _onlyBridge {
        address       destinationRecipientAddress;
        uint256       amount;
        bytes  memory tokenID;

        assembly {
            destinationRecipientAddress := mload(add(data, 0x20))
            amount                      := mload(add(data, 0x40))

            tokenID                     := mload(0x40)
            let lenTokenID              := mload(add(0x40, data))

            mstore(0x40, add(0x40, add(tokenID, lenTokenID)))

            // in the calldata the tokenID is stored at 0x64 after accounting for the function signature and length declaration
            calldatacopy(
                tokenID,                   // copy to metaData
                0x64,                      // copy from calldata @ 0x64
                sub(calldatasize(), 0x64)  // copy size (calldatasize - 0x64)
            )
        }

        if (_tokenIDToTokenContractAddress[tokenID] != address(0)) {
            // token exists
            uint256 tokenChainID;
            address tokenAddress;
            assembly {
                tokenChainID := mload(add(data,0x80))
                tokenAddress := mload(add(data,0xA0))
            }

            IBridge bridge = IBridge(_bridgeAddress);
            uint256 chainID = bridge._chainID();

            if (tokenChainID == chainID) {
                // token is from same chain
                releaseERC20(tokenAddress, address(this), destinationRecipientAddress, amount);
            } else {
                // token is not from chain
                mintERC20(tokenAddress, destinationRecipientAddress, amount);
            }
        } else {
            // Token doesn't exist
            ERC20Mintable erc20 = new ERC20Mintable();

            // Create a relationship between the originAddress and the synthetic
            _tokenIDToTokenContractAddress[tokenID] = address(erc20);
            _tokenContractAddressToTokenID[address(erc20)] = tokenID;
            
            mintERC20(address(erc20), destinationRecipientAddress, amount);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, address(this), recipient, amount);
    }
}
