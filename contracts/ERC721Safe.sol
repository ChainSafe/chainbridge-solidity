pragma solidity 0.6.4;

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

    // ERC721 contract => amount of tokens owned by Safe
    mapping(address => uint256) public _balances;

    // ERC721 contract => amount of tokens burned by Safe
    mapping(address => uint256) public _burnedTokens;

    /**
        @notice Used to transfer tokens into the safe to fund proposals.
        @param tokenAddress Address of ERC721 to transfer.
        @param owner Address of current token owner.
        @param tokenID ID of token to transfer.
        @notice Increments balance for {tokenAddress}.
     */
    function fundERC721(address tokenAddress, address owner, uint tokenID) public {
        IERC721 erc721 = IERC721(tokenAddress);
        _safeTransferFrom(erc721, owner, address(this), tokenID);

        _balances[tokenAddress] = _balances[tokenAddress].add(1);
    }

    /**
        @notice Used to gain custoday of deposited token.
        @param tokenAddress Address of ERC721 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer token to.
        @param tokenID ID of token to transfer.
        @notice Increments balance for {tokenAddress}.
     */
    function lockERC721(address tokenAddress, address owner, address recipient, uint tokenID) internal {
        IERC721 erc721 = IERC721(tokenAddress);
        _safeTransferFrom(erc721, owner, recipient, tokenID);

        _balances[tokenAddress] = _balances[tokenAddress].add(1);
    }

    /**
        @notice Transfers custody of token to recipient.
        @param tokenAddress Address of ERC721 to transfer.
        @param owner Address of current token owner.
        @param recipient Address to transfer token to.
        @param tokenID ID of token to transfer.
        @notice Decrements balance for {tokenAddress}.
     */
    function releaseERC721(address tokenAddress, address owner, address recipient, uint256 tokenID) internal {
        IERC721 erc721 = IERC721(tokenAddress);
        _safeTransferFrom(erc721, owner, recipient, tokenID);

        _balances[tokenAddress] = _balances[tokenAddress].sub(1);
    }

    /**
        @notice Used to create new ERC721s.
        @param tokenAddress Address of ERC721 to mint.
        @param recipient Address to mint token to.
        @param tokenID ID of token to mint.
        @param data Optional data to send along with mint call.
        @notice Increments balance for {tokenAddress}.
     */
    function mintERC721(address tokenAddress, address recipient, uint256 tokenID, bytes memory data) internal {
        ERC721MinterBurnerPauser erc721 = ERC721MinterBurnerPauser(tokenAddress);
        erc721.mint(recipient, tokenID, string(data));

        if (address(this) == recipient) {
            _balances[tokenAddress] = _balances[tokenAddress].add(1);
        }
    }

    /**
        @notice Used to burn ERC721s.
        @param tokenAddress Address of ERC721 to burn.
        @param tokenID ID of token to burn.
        @notice Increments {_burnedTokens} balance for {tokenAddress}.
     */
    function burnERC721(address tokenAddress, uint256 tokenID) internal {
        ERC721MinterBurnerPauser erc721 = ERC721MinterBurnerPauser(tokenAddress);
        erc721.burn(tokenID);

        _burnedTokens[tokenAddress] = _burnedTokens[tokenAddress].add(1);
    }

    /**
        @notice used to transferFrom ERC721s safely
        @param token Token instance to transfer
        @param from Address to transfer token from
        @param to Address to transfer token to
        @param tokenID ID of token to transfer
     */
    function _safeTransferFrom(IERC721 token, address from, address to, uint256 tokenID) private {        
        (bool success, bytes memory returndata) = address(token).call(abi.encodeWithSelector(token.transferFrom.selector, from, to, tokenID));
        require(success, "ERC721: transfer from failed");

        if (returndata.length > 0) {

            require(abi.decode(returndata, (bool)), "ERC721: transfer from did not succeed");
        }

    }
}
