// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WildCityCatalogNFT} from "./WildCityCatalogNFT.sol";

/// @title Wild City PH vehicle catalog
/// @dev param is top speed in tenths of metres per second; all vehicles are category zero.
contract WildCityVehicle is WildCityCatalogNFT {
    constructor(address usdc, address initialOwner)
        WildCityCatalogNFT("Wild City PH Vehicle", "WCVEH", usdc, initialOwner)
    {
        _addType("Okada Bike", 1_000000, 110, 5000, 0);
        _addType("Keke Tricycle", 2_500000, 130, 3000, 0);
        _addType("City Car", 5_000000, 170, 1500, 0);
        _addType("Sports Car", 10_000000, 240, 500, 0);
    }
}
