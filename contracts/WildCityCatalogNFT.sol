// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Wild City PH enumerable, USDC-priced item catalog
/// @dev Built for solc 0.8.28 / Cancun and OpenZeppelin 5.6.1. Prices use 6-decimal USDC units.
/// Purchase proceeds stay here; there are no fees, native payments, or withdrawal functions.
abstract contract WildCityCatalogNFT is ERC721Enumerable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct ItemType {
        string name;
        uint128 price;
        uint128 param;
        uint32 maxSupply;
        uint32 minted;
        uint8 category;
        bool active;
    }

    error InvalidUSDC();
    error UnknownType(uint256 typeId);
    error InactiveType(uint256 typeId);
    error SoldOut(uint256 typeId);
    error InvalidSupply();
    error OwnerEnumerationTooLarge(uint256 balance);

    event ItemPurchased(address indexed buyer, uint256 indexed typeId, uint256 indexed tokenId, uint256 price);
    event TypeAdded(uint256 indexed typeId, string name, uint128 price, uint128 param, uint32 maxSupply, uint8 category);
    event TypeActiveChanged(uint256 indexed typeId, bool active);
    event PriceChanged(uint256 indexed typeId, uint128 price);

    IERC20 public immutable usdc;
    uint256 public constant MAX_OWNER_ENUMERATION = 10_000;
    ItemType[] internal _types;
    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => uint256 typeId) public typeOf;

    constructor(string memory name_, string memory symbol_, address usdc_, address initialOwner)
        ERC721(name_, symbol_)
        Ownable(initialOwner)
    {
        if (usdc_ == address(0) || usdc_.code.length == 0) revert InvalidUSDC();
        usdc = IERC20(usdc_);
    }

    /// @notice Buy one unit. Approve this collection to spend USDC first.
    /// @dev Reserves supply and the token ID before payment; safe-mint callbacks cannot reenter purchases or pricing.
    function buy(uint256 typeId) external nonReentrant returns (uint256 tokenId) {
        ItemType storage item = _getType(typeId);
        if (!item.active) revert InactiveType(typeId);
        if (item.minted >= item.maxSupply) revert SoldOut(typeId);
        uint256 price = item.price;
        ++item.minted;
        tokenId = _nextTokenId++;
        typeOf[tokenId] = typeId;
        usdc.safeTransferFrom(msg.sender, address(this), price);
        _safeMint(msg.sender, tokenId);
        emit ItemPurchased(msg.sender, typeId, tokenId, price);
    }

    /// @notice Append an active item type; IDs start at zero.
    function addType(string calldata name_, uint128 price, uint128 param, uint32 maxSupply, uint8 category)
        external onlyOwner nonReentrant returns (uint256 typeId)
    {
        return _addType(name_, price, param, maxSupply, category);
    }

    /// @notice Enable or disable future purchases without changing existing tokens.
    function setTypeActive(uint256 typeId, bool active) external onlyOwner nonReentrant {
        _getType(typeId).active = active;
        emit TypeActiveChanged(typeId, active);
    }

    /// @notice Change the price of future purchases only.
    function setPrice(uint256 typeId, uint128 price) external onlyOwner nonReentrant {
        _getType(typeId).price = price;
        emit PriceChanged(typeId, price);
    }

    /// @notice Number of catalog types, including inactive and sold-out types.
    function typeCount() external view returns (uint256) {
        return _types.length;
    }

    /// @notice Read a type's configuration and lifetime minted supply.
    function getType(uint256 typeId) external view returns (ItemType memory) {
        return _getType(typeId);
    }

    /// @notice Enumerate an owner's tokens and matching type IDs.
    /// @dev Reverts above 10,000 tokens rather than silently truncating. Use tokenOfOwnerByIndex for larger wallets.
    function tokensOfOwner(address player) external view returns (uint256[] memory tokenIds, uint256[] memory typeIds) {
        uint256 count = balanceOf(player);
        if (count > MAX_OWNER_ENUMERATION) revert OwnerEnumerationTooLarge(count);
        tokenIds = new uint256[](count);
        typeIds = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            uint256 tokenId = tokenOfOwnerByIndex(player, i);
            tokenIds[i] = tokenId;
            typeIds[i] = typeOf[tokenId];
        }
    }

    function _addType(string memory name_, uint128 price, uint128 param, uint32 maxSupply, uint8 category)
        internal returns (uint256 typeId)
    {
        if (maxSupply == 0) revert InvalidSupply();
        typeId = _types.length;
        _types.push(ItemType(name_, price, param, maxSupply, 0, category, true));
        emit TypeAdded(typeId, name_, price, param, maxSupply, category);
    }

    function _getType(uint256 typeId) internal view returns (ItemType storage item) {
        if (typeId >= _types.length) revert UnknownType(typeId);
        return _types[typeId];
    }
}
