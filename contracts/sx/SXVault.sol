pragma solidity 0.6.4;

/**
    @title Manages deposited native SX.
    @notice This contract is intended to be used with GenericHandler contract.
 */
contract SXVault {
  address public _owner;
  address public _handlerAddress;

  event Fund(address indexed addr, uint256 amount);
  event Withdraw(address indexed addr, uint256 amount);
  event Deposit(address indexed addr, uint256 amount);
  event Execute(address indexed addr, uint256 amount);

  modifier onlyOwner() {
    require(msg.sender == _owner, 'Ownable: You are not the owner.');
    _;
  }

  modifier onlyHandler() {
    require(msg.sender == _handlerAddress, 'sender must be handler contract');
    _;
  }

  constructor(address handlerAddress) public {
    _owner = msg.sender;
    _handlerAddress = handlerAddress;
  }

  receive() external payable {
    fund();
  }

  /**
    @notice Payable function used to fund contract.
  */
  function fund() public payable {
    emit Fund(msg.sender, msg.value);
  }

  /**
    @notice Allows for withdrawal 
    @notice Only callable by an address that has the owner role (is the contract deployer).
  */
  function withdraw(uint256 amount) public onlyOwner {
    require(address(this).balance >= amount, 'Insufficient balance.');

    // transfer sender SX
    (bool success, ) = payable(msg.sender).call{ value: amount }('');
    require(success, 'Transfer failed.');

    emit Withdraw(msg.sender, amount);
  }

  /**
    @notice NOT USED YET - we don't support native SX->Polygon bridge transfers yet.
    @notice Locks specified amount of SX when bridging SX out of SXN. Called by deposit() of ChainBridge GenericHandler.
  */
  function deposit(address depositor, uint256 amount) public onlyHandler {
    emit Deposit(depositor, amount);
  }

  /**
    @notice Unlocks specified amount of SX to the specified recipient. Called by executeProposal() of ChainBridge GenericHandler.
  */
  function execute(address recipient, uint256 amount) public onlyHandler {
    //require(address(this).balance >= amount, 'Insufficient balance.');

    //deposits[msg.sender] += msg.value;

    // transfer recipient SX
    //(bool success, ) = payable(recipient).call{ value: amount }('');
    //require(success, 'Transfer failed.');

    //TODO: emit event
    emit Execute(recipient, amount);
  }
}
