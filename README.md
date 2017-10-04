# homebridge-nuheat

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-dht.svg?style=flat)](https://npmjs.org/package/homebridge-nuheat)

This is a plugin for MyNuHeat site. It is a partially-working
implementation into HomeKit. This plugin is work in progress. Help is appreciated!



# Installation

1. Install homebridge using: npm install -g homebridge <br>
2. Install this plugin using npm install -g homebridge-nuheat
3. Update your configuration file. See sample-config below for a sample.

# Configuration Sample

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

- platform: NuHeat
- name: can be anything you want
- username: your MyNuHeat e-mail
- password: your MyNuHeat password
- deviceID: Your nuheat serial number. Go to the MyNuHeat website, log in and click 'View Details' on your device. Look for the thermostat ID.
- debug: optional parameter, will return details in log around response from MyNuHeat,
use full for debugging no response errors.
- refresh: How often the data is refreshed from the MyNuHeat website, in seconds.  Defaults to 60

# Roadmap



# Notes



# Credits

- northernman - pretty much hacked this all together based on your homebridge-tcc plugin (since I was already using it)