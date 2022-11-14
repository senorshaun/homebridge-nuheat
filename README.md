# homebridge-nuheat

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-dht.svg?style=flat)](https://npmjs.org/package/homebridge-nuheat)

This is a plugin for NuHeat Signature Floor Heat Thermostats. The goal is to automate schedules based on HomeKit integration (scenes, geofencing, etc).

## Features
* Auto detection and configuration of all thermostats
* Auto detection and configuration of away mode switches for groups
* Customized hold lengths

## Installation

Install homebridge using: 
```
npm install -g homebridge
```
Install this plugin using 
```
npm install -g homebridge-nuheat
```

## Configuration
Most people will use `Config-UI` to customize the plugin, but here is an example config

```
"platforms": [
		{
			"platform": "NuHeat",
			"name":     "NuHeat",
			"Email" : "email@address.com",
			"password" : "password123",
			"devices" : [
				{"serialNumber": "1111111"},
				{"serialNumber": "2222222"}
			]
		},
    ]
```

- `platform` NuHeat
- `name` can be anything you want, this is what the platform will display its logs as 
- `email` your MyNuHeat e-mail
- `password` your MyNuHeat password
- `devices` These are your thermostats ***Note if you leave this empty, the plugin with auto detect and add all thermostats on your account***
- `serialNumber` Your thermostat's serial number. Go to the [MyNuHeat website](https://www.mynuheat.com/), log in and click 'View Details' on your device. Look for the thermostat ID
- `autoPopulateAwayModeSwitches` boolean value that allows the plugin to create away mode switches for all groups on the account
- `groups` These are your groups for away mode switches
- `groupName` The pre-set name for the group as reflect in MyNuHeat
- `holdLength` This is how long a change, made via HomeKit, will be in effect. Integer value representing minutes between 0 and 1440. When set to 0, the setpoint change will only be in effect until the next scheduled event. When set to 1440, the setpoint change is a permenant hold ***(default)***. Anything else , the setpoing change will last for X minutes.
- `refresh` How often the data is refreshed from the MyNuHeat website, in seconds.  Defaults to 60
- `debug` will return lots details in the Homebridge logs


## Roadmap
Looks like the signalR notification channel isn't working properly, so right now we are still polling based on `refresh`. It would be nice to switch over to only update when signalR notifies us