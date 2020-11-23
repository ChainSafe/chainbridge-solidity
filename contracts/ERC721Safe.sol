pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ERC721MinterBurnerPauser.sol";

/**
    @title Manages deposited ERC721s.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with ERC721Handler contract.
 */
contract ERC721Safe {
    using SafeMath for uint256;

    /**
        @notice Used to transfer tokens into the safe to fund proposals.
        @param tokenAddress Address of ERC721 to transfer.
        @param owner Address of current token owner.
        @param tokenID ID of token to transfer.
     */
    function fundERC721(address tokenAddress, address owner, uint tokenID) public {
        IERC721 erc721 = IERC721(tokenAddress);
        erc721.transferFrom(owner, address(this), tokenID);
    }

    /**
        @notice Used to gain custoday of deposited token.
        @param tokenAddress Address of ERC721 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer token to.
        @param tokenID ID of token to transfer.
     */
    function lockERC721(address tokenAddress, address owner, address recipient, uint tokenID) internal {
        IERC721 erc721 = IERC721(tokenAddress);
        erc721.transferFrom(owner, recipient, tokenID);

    }

    /**
        @notice Transfers custody of token to recipient.
        @param tokenAddress Address of ERC721 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer token to.
        @param tokenID ID of token to transfer.
     */
    function releaseERC721(address tokenAddress, address owner, address recipient, uint256 tokenID) internal {
        IERC721 erc721 = IERC721(tokenAddress);
        erc721.transferFrom(owner, recipient, tokenID);
    }

    /**
        @notice Used to create new ERC721s.
        @param tokenAddress Address of ERC721 to mint.
        @param recipient Address to mint token to.
        @param tokenID ID of token to mint.
        @param data Optional data to send along with mint call.
     */
    function mintERC721(address tokenAddress, address recipient, uint256 tokenID, bytes memory data) internal {
        ERC721MinterBurnerPauser erc721 = ERC721MinterBurnerPauser(tokenAddress);
        erc721.mint(recipient, tokenID, string(data));
    }

    /**
        @notice Used to burn ERC721s.
        @param tokenAddress Address of ERC721 to burn.
        @param tokenID ID of token to burn.
     */
    function burnERC721(address tokenAddress, uint256 tokenID) internal {
        ERC721MinterBurnerPauser erc721 = ERC721MinterBurnerPauser(tokenAddress);
        erc721.burn(tokenID);
    }

}
