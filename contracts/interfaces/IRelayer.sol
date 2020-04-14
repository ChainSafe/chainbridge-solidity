pragma solidity 0.6.4;

interface IRelayer {
    enum Vote {No, Yes}
    enum RelayerActionType {Remove, Add}
    enum VoteStatus {Inactive, Active}

    function isRelayer(address relayerAddress) external returns (bool);
    function getTotalRelayers() external returns (uint);
    function voteRelayerProposal(address proposedAddress, RelayerActionType action) external;
    function createRelayerThresholdProposal(uint proposedValue) external;
    function voteRelayerThresholdProposal(Vote vote) external;
}
