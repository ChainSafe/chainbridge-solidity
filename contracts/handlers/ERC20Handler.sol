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
        string  _tokenID;
        address _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // tokenID => token contract address
    mapping (string => address) public _tokenIDToTokenContractAddress;

    // token contract address => tokenID
    mapping (address => string) public _tokenContractAddressToTokenID;

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

        string memory tokenID = _tokenContractAddressToTokenID[originChainTokenAddress];

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

    function createTokenID(uint256 chainID, address originChainTokenAddress) internal pure returns (string memory) {
        return string(abi.encodePacked(chainID, originChainTokenAddress));
    }

    // Copied from https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L1020
    function parseInt(string memory _a, uint _b) internal pure returns (uint _parsedInt) {
        bytes memory bresult = bytes(_a);
        uint mint = 0;
        bool decimals = false;
        for (uint i = 0; i < bresult.length; i++) {
            if ((uint(uint8(bresult[i])) >= 48) && (uint(uint8(bresult[i])) <= 57)) {
                if (decimals) {
                   if (_b == 0) {
                       break;
                   } else {
                       _b--;
                   }
                }
                mint *= 10;
                mint += uint(uint8(bresult[i])) - 48;
            } else if (uint(uint8(bresult[i])) == 46) {
                decimals = true;
            }
        }
        if (_b > 0) {
            mint *= 10 ** _b;
        }
        return mint;
    }

    // copied from https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L872
    function parseAddr(string memory _a) internal pure returns (address _parsedAddress) {
        bytes memory tmp = bytes(_a);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    // copied from https://ethereum.stackexchange.com/questions/31457/substring-in-solidity
    function subString(string memory str, uint startIndex, uint endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex-startIndex);
        for(uint i = startIndex; i < endIndex; i++) {
            result[i-startIndex] = strBytes[i];
        }
        return string(result);
    }

    // execute a deposit
    // bytes memory data is laid out as following:
    // destinationRecipientAddress address   - @0x20 - 0x40
    // amount                      uint256   - @0x40 - 0x60
    // tokenID                               - @0x60 - END
    // tokenID length declaration  uint256   - @0x60 - 0x80
    // tokenID                     string    - @0x80 - END
    function executeDeposit(bytes memory data) public override _onlyBridge {
        address       destinationRecipientAddress;
        uint256       amount;
        string memory tokenID;

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
            uint256 tokenChainID = parseInt(subString(tokenID, 0, 1), 0);
            address tokenAddress = parseAddr(subString(tokenID, 2, bytes(tokenID).length));

            IBridge bridge = IBridge(_bridgeAddress);
            uint256 chainID = bridge._chainID();

            if (tokenChainID == chainID) {
                // token is from same chain
                ERC20Mintable erc20 = ERC20Mintable(tokenAddress);
                erc20.transferFrom(address(this), destinationRecipientAddress, amount);
            } else {
                // token is not from chain
                ERC20Mintable erc20 = ERC20Mintable(tokenAddress);
                erc20.mint(destinationRecipientAddress, amount);
            }
        } else {
            // Token doesn't exist
            ERC20Mintable erc20 = new ERC20Mintable();

            // Create a relationship between the originAddress and the synthetic
            _tokenIDToTokenContractAddress[tokenID] = address(erc20);
            _tokenContractAddressToTokenID[address(erc20)] = tokenID;

            erc20.mint(destinationRecipientAddress, amount);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, address(this), recipient, amount);
    }
}
