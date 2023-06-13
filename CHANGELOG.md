# Changelog
All notable changes to this project should be documented in this file

## [1.2.2] - 2023-06-13
### Fixed
 - variable typo


## [1.2.1] - 2023-06-01
### Fixed
 - hold length bug

## [1.2.0] - 2023-05-26
### Changed
 - client secret for api auth

### Fixed
 - async updates from the api to reduce cookie creation

## [1.1.4] - 2023-05-12
### Changed
 - error handling when unable to get access token, as to not crash homebridge

## [1.1.3] - 2023-04-17
### Fixed
 - typo in away mode

## [1.1.2] - 2022-12-24
### Fixed
 - some unhandled api auth error
### Changed
 - some debug logging code

## [1.1.1] - 2022-11-17
### Fixed
 - changed the 'homebridge-nuheat' name to be lower case so HOOBS handles properly

 ## [1.1.0] - 2022-11-15
 ### Added
 - Added `homebridge-ui` support with auto detection
 - Added Away Mode switches for groups
 ### Changed
 - Changed the underlying API to use nuheats new api system
