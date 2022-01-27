pragma solidity 0.6.4;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
    @title Manages deposited native SX to be paid out to bridge arrivals.
    @notice This contract is currently used by our bridging ERC20SXHandler contract, which is permissioned to
    call {bridgeExit()} - the final/exit function used to support ChainBridge transfers from ERC-20 tokens 
    on the origin chain to native tokens on our own chain.
    @notice This contract requires periodic top ups of native tokens.
 */
contract SXVault is AccessControl {

  address public _handlerAddress;

  event Fund(address indexed addr, uint256 amount);
  event Withdraw(address indexed addr, uint256 amount);
  event BridgeExit(address indexed addr, uint256 amount);

  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), 'Sender must be an admin.');
    _;
  }

  modifier onlyHandler() {
    require(_handlerAddress == msg.sender, 'Sender must be handler contract.');
    _;
  }

  /**
      @notice Initializes SXVault, assigns {msg.sender} as the admin (referenced by onlyAdmin),
      assigns {handlerAddress} used by onlyHandler.
      @param handlerAddress Address of the ERC20SXHandler contract, permissioned to call bridgeExit().
  */
  constructor(address handlerAddress) public {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _handlerAddress = handlerAddress;
  }

  /**
      @notice Assigns {handlerAddress} used by ownlyHandler.
      @notice Only callable by admin.
      @param handlerAddress Address of the ERC20SXHandler contract, permissioned to call bridgeExit().
  */
  function setHandler(address handlerAddress) external onlyAdmin {
    _handlerAddress = handlerAddress;
  }

  receive() external payable {
    fund();
  }

  /**
      @notice Fund the contract with {msg.value} from {msg.sender}.
      @notice Emits {Fund} event.
  */
  function fund() public payable {
    emit Fund(msg.sender, msg.value);
  }

  /**
      @notice Withdraw {amount} from the contract.
      @notice Only callable by admin.
      @notice Emits {Withdraw} event.
  */
  function withdraw(uint256 amount) external onlyAdmin {
    require(address(this).balance >= amount, 'Insufficient balance.');

    (bool success, ) = payable(msg.sender).call{ value: amount }('');
    require(success, 'Transfer failed.');

    emit Withdraw(msg.sender, amount);
  }

  /**
      @notice Sends the specified {recipient} native SX specified by {amount}.
      @notice Only callable by handler.
      @notice Emits {BridgeExit} event.
  */
  function bridgeExit(address recipient, uint256 amount) external onlyHandler {
    require(address(this).balance >= amount, 'Insufficient balance.');

    (bool success, ) = payable(recipient).call{ value: amount }('');
    require(success, 'Transfer failed.');

    emit BridgeExit(recipient, amount);
  }
}
