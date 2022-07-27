//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./interfaces/IClaimSubsidiary.sol";
import "@fractal-framework/core-contracts/contracts/ModuleBase.sol";
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ClaimSubsidiary is ModuleBase, IClaimSubsidiary {
    using SafeERC20 for IERC20;

    address public cToken;
    mapping(address => ChildTokenInfo) public cTokenInfo; // cToken => cTokenInfo

    /// @notice Initilize Claim Contract
    /// @param _metaFactory Address funding claimContract
    /// @param _accessControl Address of AccessControl
    /// @param _pToken Address of the parent token used for snapshot reference
    /// @param _cToken Address of child Token being claimed
    /// @param _pAllocation Total tokens allocated for pToken holders
    function initialize(
        address _metaFactory,
        address _accessControl,
        address _pToken,
        address _cToken,
        uint256 _pAllocation
    ) external initializer {
        __initBase(_accessControl, msg.sender, "Claim Subsidiary");
        _registerInterface(type(IClaimSubsidiary).interfaceId);
        cToken = _cToken;
        _createSubsidiary(_metaFactory, _pToken, _cToken, _pAllocation);
    }

    ////////////////////////// SnapShot //////////////////////////////////
    /// @notice This function creates a cToken and assigns a snapshot Id for pToken holder claims
    /// @param _pToken Address of the parent token used for snapshot reference
    /// @param _cToken Address of child Token being claimed
    /// @param _pAllocation Total tokens allocated for pToken holders
    /// @return snapId snapId number
    function _createSubsidiary(
        address _metaFactory,
        address _pToken,
        address _cToken,
        uint256 _pAllocation
    ) internal returns (uint256 snapId) {
        IERC20(_cToken).transferFrom(_metaFactory, address(this), _pAllocation);
        snapId = VotesToken(_pToken).captureSnapShot();
        cTokenInfo[_cToken].pToken = _pToken;
        cTokenInfo[_cToken].snapId = snapId;
        cTokenInfo[_cToken].pAllocation = _pAllocation;
        emit SnapAdded(_pToken, _cToken, _pAllocation);
    }

    /// @notice This function allows pToken holders to claim cTokens
    /// @param claimer Address which is being claimed for
    function claimSnap(address claimer) external {
        uint256 amount = calculateClaimAmount(claimer); // Get user balance
        require(amount > 0, "The claimer does not have an allocation");
        require(
            !cTokenInfo[cToken].isSnapClaimed[claimer],
            "This allocation has been claimed"
        );
        cTokenInfo[cToken].isSnapClaimed[claimer] = true;

        IERC20(cToken).safeTransfer(claimer, amount); // transfer user balance
        emit SnapClaimed(cTokenInfo[cToken].pToken, cToken, claimer, amount);
    }

    //////////////////// View Functions //////////////////////////
    /// @notice Calculate a users cToken allocation
    /// @param claimer Address which is being claimed for
    /// @return cTokenAllocation Users cToken allocation
    function calculateClaimAmount(address claimer)
        public
        view
        returns (uint256 cTokenAllocation)
    {
        cTokenAllocation =
            (VotesToken(cTokenInfo[cToken].pToken).balanceOfAt(
                claimer,
                cTokenInfo[cToken].snapId
            ) * cTokenInfo[cToken].pAllocation) /
            VotesToken(cTokenInfo[cToken].pToken).totalSupplyAt(
                cTokenInfo[cToken].snapId
            );
    }

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[48] private __gap;
}
