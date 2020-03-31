pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "./helpers/SafeMath.sol";
import "./interfaces/IRelayer.sol";
import "./interfaces/IDepositHandler.sol";

contract Bridge {
    using SafeMath for uint;

    uint256                  public _chainID;
    IRelayer                 public _relayerContract;
    uint256                  public _relayerThreshold;
    RelayerThresholdProposal public _currentRelayerThresholdProposal;

    enum Vote {No, Yes}
    enum RelayerThresholdProposalStatus {Inactive, Active}
    enum DepositProposalStatus {Inactive, Active, Denied, Passed, Transferred}

    struct DepositProposal {
        bytes32                  _dataHash;
        address[]                _yesVotes;
        address[]                _noVotes;
        DepositProposalStatus    _status;
    }

    struct RelayerThresholdProposal {
        uint256                        _proposedValue;
        mapping(address => bool)       _hasVoted;
        address[]                      _yesVotes;
        address[]                      _noVotes;
        RelayerThresholdProposalStatus _status;
    }

    // destinationChainID => number of deposits
    mapping(uint256 => uint256) public _depositCounts;
    // destinationChainID => depositNonce => bytes
    mapping(uint256 => mapping(uint256 => bytes)) public _depositRecords;
    // destinationChainID => depositNonce => depositProposal
    mapping(uint256 => mapping(uint256 => DepositProposal)) public _depositProposals;
    // destinationChainID => depositNonce => relayerAddress => bool
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public _hasVotedOnDepositProposal;

    event RelayerThresholdProposalCreated(uint indexed proposedValue);
    event RelayerThresholdProposalVote(Vote vote);
    event RelayerThresholdChanged(uint indexed newThreshold);
    event Deposit(
        uint256 indexed originChainID,
        uint256 indexed destinationChainID,
        address indexed originChainHandlerAddress,
        uint256         depositNonce
    );
    event DepositProposalCreated(
        uint256 indexed originChainID,
        uint256 indexed destinationChainID,
        uint256 indexed depositNonce,
        bytes32         dataHash
    );
    event DepositProposalVote(
        uint256 indexed       originChainID,
        uint256 indexed       destinationChainID,
        uint256 indexed       depositNonce,
        Vote                  vote,
        DepositProposalStatus status
    );
    event DepositProposalFinalized(
        uint256 indexed originChainID,
        uint256 indexed destinationChainID,
        uint256 indexed depositNonce
    );
    event DepositProposalExecuted(
        uint256 indexed originChainID,
        uint256 indexed destinationChainID,
        uint256 indexed depositNonce
    );

    modifier _onlyRelayers() {
        IRelayer relayerContract = IRelayer(_relayerContract);
        require(relayerContract.isRelayer(msg.sender), "sender must be a relayer");
        _;
    }

    constructor (uint256 chainID, address relayerContract, uint initialRelayerThreshold) public {
        _chainID = chainID;
        _relayerContract = IRelayer(relayerContract);
        _relayerThreshold = initialRelayerThreshold;
    }

    function getCurrentRelayerThresholdProposal() public view returns (
        uint256, address[] memory, address[] memory, RelayerThresholdProposalStatus) {
        return (
            _currentRelayerThresholdProposal._proposedValue,
            _currentRelayerThresholdProposal._yesVotes,
            _currentRelayerThresholdProposal._noVotes,
            _currentRelayerThresholdProposal._status
        );
    }

    function getDepositProposal(
        uint256 destinationChainID,
        uint256 depositNonce
    ) public view returns (DepositProposal memory) {
        return _depositProposals[destinationChainID][depositNonce];
    }

    function deposit(
        uint256      destinationChainID,
        address      originChainHandlerAddress,
        bytes memory data
    ) public {
        uint256 depositNonce = ++_depositCounts[destinationChainID];
        _depositRecords[destinationChainID][depositNonce] = data;

        IDepositHandler depositHandler = IDepositHandler(originChainHandlerAddress);
        depositHandler.deposit(destinationChainID, depositNonce, msg.sender, data);

        emit Deposit(_chainID, destinationChainID, originChainHandlerAddress, depositNonce);
    }

    function createDepositProposal(
        uint256 destinationChainID,
        uint256 depositNonce,
        bytes32 dataHash
    ) public _onlyRelayers {
        require(
            _depositProposals[destinationChainID][depositNonce]._status == DepositProposalStatus.Inactive ||
            _depositProposals[destinationChainID][depositNonce]._status == DepositProposalStatus.Denied,
            "proposal is either currently active or has already been passed/transferred"
        );

        _depositProposals[destinationChainID][depositNonce] = DepositProposal({
            _dataHash: dataHash,
            _yesVotes: new address[](1),
            _noVotes: new address[](0),
            _status: DepositProposalStatus.Active
        });

        // If _depositThreshold is set to 1, then auto finalize
        if (_relayerThreshold <= 1) {
            _depositProposals[destinationChainID][depositNonce]._status = DepositProposalStatus.Passed;
        }

        // Creator always votes in favour
        _depositProposals[destinationChainID][depositNonce]._yesVotes[0] = msg.sender;
        _hasVotedOnDepositProposal[destinationChainID][depositNonce][msg.sender] = true;

        emit DepositProposalCreated(_chainID, destinationChainID, depositNonce, dataHash);
    }

    function voteDepositProposal(
        uint256 destinationChainID,
        uint256 depositNonce,
        Vote    vote
    ) public _onlyRelayers {
        DepositProposal storage depositProposal = _depositProposals[destinationChainID][depositNonce];

        require(depositProposal._status != DepositProposalStatus.Inactive, "proposal is not active");
        require(depositProposal._status == DepositProposalStatus.Active, "proposal has been finalized");
        require(!_hasVotedOnDepositProposal[destinationChainID][depositNonce][msg.sender], "relayer has already voted");
        require(uint8(vote) <= 1, "invalid vote");

        if (vote == Vote.Yes) {
            depositProposal._yesVotes.push(msg.sender);
        } else {
            depositProposal._noVotes.push(msg.sender);
        }

        _hasVotedOnDepositProposal[destinationChainID][depositNonce][msg.sender] = true;

        // Todo: Edge case if relayer threshold changes?
        if (depositProposal._yesVotes.length >= _relayerThreshold) {
            depositProposal._status = DepositProposalStatus.Passed;
            emit DepositProposalFinalized(_chainID, destinationChainID, depositNonce);
        } else if (_relayerContract.getTotalRelayers().sub(depositProposal._noVotes.length) < _relayerThreshold) {
            depositProposal._status = DepositProposalStatus.Denied;
            emit DepositProposalFinalized(_chainID, destinationChainID, depositNonce);
        }

        emit DepositProposalVote(_chainID, destinationChainID, depositNonce, vote, depositProposal._status);
    }

    function executeDepositProposal(
        uint256      originChainID,
        uint256      depositNonce,
        address      destinationChainHandlerAddress,
        bytes memory data
    ) public {
        DepositProposal storage depositProposal = _depositProposals[_chainID][depositNonce];

        require(depositProposal._status != DepositProposalStatus.Inactive, "proposal is not active");
        require(depositProposal._status == DepositProposalStatus.Passed, "proposal was not passed or has already been transferred");
        require(keccak256(data) == depositProposal._dataHash, "provided data does not match proposal's data hash");

        IDepositHandler depositHandler = IDepositHandler(destinationChainHandlerAddress);
        depositHandler.executeDeposit(data);

        depositProposal._status = DepositProposalStatus.Transferred;
        emit DepositProposalExecuted(originChainID, _chainID, depositNonce);
    }

    function createRelayerThresholdProposal(uint proposedValue) public _onlyRelayers {
        require(_currentRelayerThresholdProposal._status == RelayerThresholdProposalStatus.Inactive, "a proposal is currently active");
        require(proposedValue <= _relayerContract.getTotalRelayers(), "proposed value cannot be greater than the total number of relayers");

        _currentRelayerThresholdProposal = RelayerThresholdProposal({
            _proposedValue: proposedValue,
            _yesVotes: new address[](1),
            _noVotes: new address[](0),
            _status: RelayerThresholdProposalStatus.Active
            });

        if (_relayerThreshold <= 1) {
            _relayerThreshold = _currentRelayerThresholdProposal._proposedValue;
            _currentRelayerThresholdProposal._status = RelayerThresholdProposalStatus.Inactive;
            emit RelayerThresholdChanged(proposedValue);
        }
        // Record vote
        _currentRelayerThresholdProposal._yesVotes[0] = msg.sender;
        _currentRelayerThresholdProposal._hasVoted[msg.sender] = true;
        emit RelayerThresholdProposalCreated(proposedValue);
    }

    function voteRelayerThresholdProposal(Vote vote) public _onlyRelayers {
        require(_currentRelayerThresholdProposal._status == RelayerThresholdProposalStatus.Active, "no proposal is currently active");
        require(!_currentRelayerThresholdProposal._hasVoted[msg.sender], "relayer has already voted");
        require(uint8(vote) <= 1, "vote out of the vote enum range");

        // Cast vote
        if (vote == Vote.Yes) {
            _currentRelayerThresholdProposal._yesVotes.push(msg.sender);
        } else {
            _currentRelayerThresholdProposal._noVotes.push(msg.sender);
        }

        _currentRelayerThresholdProposal._hasVoted[msg.sender] = true;
        emit RelayerThresholdProposalVote(vote);

        // Todo: Edge case if relayer threshold changes?
        // Todo: For a proposal to pass does the number of yes votes just need to be higher than the threshold, or does it also have to be greater than the number of no votes?
        if (_currentRelayerThresholdProposal._yesVotes.length >= _relayerThreshold) {
            _relayerThreshold = _currentRelayerThresholdProposal._proposedValue;
            _currentRelayerThresholdProposal._status = RelayerThresholdProposalStatus.Inactive;
            emit RelayerThresholdChanged(_currentRelayerThresholdProposal._proposedValue);
        } else if (_relayerContract.getTotalRelayers().sub(_currentRelayerThresholdProposal._noVotes.length) < _relayerThreshold) {
            _currentRelayerThresholdProposal._status = RelayerThresholdProposalStatus.Inactive;
        }
    }
}