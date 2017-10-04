// This platform integrates NuHeat into homebridge
//
// The configuration is stored inside the ../config.json
// {
//     "platform": "NuHeat",
//     "name":     "Thermostat",
//     "Email" : "Email/username",
//     "password" : "password",
//     "debug" : "True",      - Optional
//     "refresh": "60",       - Optional
//     "devices" : [
//        {"serialNumber": "123456789"},
//        {"serialNumber": "123456789"}
//     ]
// }
//

/*jslint node: true */
'use strict';

var NuHeat = require('./lib/NuHeat.js');
var Accessory, Service, Characteristic, UUIDGen, CommunityTypes;

var myAccessories = [];
var session; // reuse the same login session
var updating; // Only one change at a time!!!!

module.exports = function(homebridge) {

    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-NuHeat", "NuHeat", NuHeatPlatform);
}

function NuHeatPlatform(log, config, api) {

    this.Email = config['Email'];
    this.password = config['password'];
    this.refresh = config['refresh'] || 60; // Update every minute
    this.debug = config['debug'] || false;
    this.log = log;
    this.devices = config['devices'];

    updating = false;
}

NuHeatPlatform.prototype = {
    accessories: function(callback) {
        this.log("Logging into NuHeat...");
        var that = this;

        NuHeat.setCharacteristic(Characteristic);
        NuHeat.setDebug(this.debug);

        NuHeat.login(that.Email, that.password).then(function(login) {
            this.log("Logged into NuHeat!");
			
            session = login;
            let requests = this.devices.map((device) => {
                return new Promise((resolve) => {

                    session.CheckDataSession(device.serialNumber,
                        function(err, deviceData) {
                            if (err) {
                                that.log("Create Device Error", err);
                                resolve();
                            } else {
                                var newAccessory = new NuHeatAccessory(that.log, deviceData.Room,
                                    deviceData, that.Email, that.password, device.serialNumber, that.debug);
                                // store accessory in myAccessories
                                myAccessories.push(newAccessory);
                                resolve();
                            }
                        });
                });
            })

            // Need to wait for all devices to be configured

            Promise.all(requests).then(() => {
                callback(myAccessories);
                that.periodicUpdate();
                setInterval(that.periodicUpdate.bind(this), this.refresh * 1000);

            });

            // End of login section
        }.bind(this)).fail(function(err) {
            // tell me if login did not work!
            that.log("Error during Login:", err);
            callback(err);
        });
    }
};

function updateStatus(service, data) {
    service.getCharacteristic(Characteristic.TargetTemperature)
        .getValue();
    service.getCharacteristic(Characteristic.CurrentTemperature)
        .getValue();
    service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .getValue();
    service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .getValue();
}

NuHeatPlatform.prototype.periodicUpdate = function(t) {
    var t = updateValues(this);
}

function updateValues(that) {
	if (that.debug) {
		that.log("Periodic update of", myAccessories.length, "devices.");
	}
    myAccessories.forEach(function(accessory) {

        session.CheckDataSession(accessory.serialNumber, function(err, deviceData) {
            if (err) {
                that.log("ERROR: UpdateValues", accessory.name, err);
                that.log("updateValues: Device not reachable", accessory.name);
                //                accessory.newAccessory.updateReachability(false);
                NuHeat.login(that.Email, that.password).then(function(login) {
                    that.log("Logged into NuHeat!");
                    session = login;
                }.bind(this)).fail(function(err) {
                    // tell me if login did not work!
                    that.log("Error during Login:", err);
                });
            } else {
                if (that.debug)
                    that.log("Update Values", accessory.name);
                // Data is live

                if (deviceData.Online = "True") {
                    //                    that.log("updateValues: Device reachable", accessory.name);
                    //                    accessory.newAccessory.updateReachability(true);
                } else {
                    that.log("updateValues: Device not reachable", accessory.name);
                    //                    accessory.newAccessory.updateReachability(false);
                }

                if (!NuHeat.deepEquals(deviceData, accessory.device)) {
                    that.log("Change", accessory.name, NuHeat.diff(accessory.device, deviceData));
                    accessory.device = deviceData;
                    updateStatus(accessory.thermostatService, deviceData);

                } else {
                    that.log("No change", accessory.name);
                }
            }
        });
    });
}

// give this function all the parameters needed

function NuHeatAccessory(log, name, deviceData, Email, password, serialNumber, debug) {

    var uuid = UUIDGen.generate(name);

    this.newAccessory = new Accessory(name, uuid);

    //    newAccessory.name = name;

    this.log = log;
    this.log("Adding NuHeat Device", name, serialNumber);
    this.name = name;
    this.device = deviceData;
    this.Email = Email;
    this.password = password;
    this.serialNumber = serialNumber;
    this.debug = debug;

    //    return newAccessory;
}

NuHeatAccessory.prototype = {
	
    getName: function(callback) {

        var that = this;
        that.log("requesting name of", this.name);
        callback(this.name);

    },

    // This is showing what the HVAC unit is doing
    getCurrentHeatingCoolingState: function(callback) {
        var that = this;
        // OFF  = 0
        // HEAT = 1

        // OperatingMode is 1 when HVAC is running in heat mode
        var CurrentHeatingCoolingState = 0;
		if (this.device.Heating) {
			CurrentHeatingCoolingState = 1;
		}
		if (this.debug) {
			that.log("getCurrentHeatingCoolingState is", CurrentHeatingCoolingState, this.name);
		}
        //        if (this.newAccessory.reachable) {
        callback(null, Number(CurrentHeatingCoolingState));
        //        } else {
        //            that.log("getCurrentHeatingCoolingState: Device not reachable");
        //            callback(new Error("Device not reachable"));
        //        }
    },
    
	getCurrentTemperature: function(callback) {
        var that = this;

        var currentTemperature = NuHeat.toHBTemperature(this.device.Temperature);
		if (this.debug) {
			that.log("Current temperature of " + this.name + " is " + currentTemperature + "°");
		}
		
        callback(null, Number(currentTemperature));
    },

    // This is to change the system switch to a different position
    setTargetHeatingCooling: function(value, callback) {
        var that = this;
        if (!updating) {
            updating = true;

            that.log("Setting system switch for", this.name, "to", value);
            // TODO:
            // verify that the task did succeed

            NuHeat.login(this.Email, this.password).then(function(session) {
                session.setSystemSwitch(that.serialNumber, NuHeat.toNuHeatHeatingCoolingSystem(value)).then(function(taskId) {
                    that.log("Successfully changed system!");
                    that.log(taskId);
                    // Update all information
                    // TODO: call periodicUpdate to refresh all data elements
                    updateValues(that);
                    callback(null, Number(1));
                });
            }).fail(function(err) {
                that.log('NuHeat Failed:', err);
                callback(null, Number(0));
            });
            callback(null, Number(0));
            updating = false
        }
    },
    
	// This is to read the system switch
    getTargetHeatingCooling: function(callback) {
        var that = this;

        // Homekit allowed values
        // OFF  = 0
        // HEAT = 1
        // COOL = 2
        // AUTO = 3

        var TargetHeatingCooling = NuHeat.toHomeBridgeHeatingCoolingSystem(this.device.OperatingMode);
		if (this.debug) {
			this.log("getTargetHeatingCooling is ", TargetHeatingCooling, this.name);
		}
        callback(null, Number(TargetHeatingCooling));

    },

    setTargetTemperature: function(value, callback) {
        var that = this;
        if (!updating) {
            updating = true;

            //    maxValue: 38,
            //    minValue: 10,

            that.log("Setting target temperature for", this.name, "to", value + "°C");

            if (value < 10)
                value = 10;

            if (value > 38)
                value = 38;

            var heatSetPoint = NuHeat.toNuHeatTemperature(value);
            // TODO:
            // verify that the task did succeed

            //            NuHeat.login(this.Email, this.password).then(function(session) {
			if (that.debug) {
				that.log("setHeatSetpoint", that.name, heatSetPoint);
			}
            session.setHeatSetpoint(that.serialNumber, heatSetPoint).then(function(taskId) {
                if (taskId.Success) {
                    that.log("Successfully changed temperature!", taskId);
                    callback();
                } else {
                    that.log("Error: Unsuccessfully changed temperature!", that.name, taskId);
                    callback(new Error("Error: setHeatSetpoint"));
                }
                updateValues(that); // refresh
            }.bind(this)).fail(function(err) {
                that.log('Error: setHeatSetpoint', that.name, err);
                callback(err);
            });
            updating = false;
        }
    },

    getTargetTemperature: function(callback) {
        var that = this;

        //    maxValue: 38,
        //    minValue: 10,
        // Homebridge expects temperatures in C, but NuHeat will return something complete different.
		
		var targetTemperature = NuHeat.toHBTemperature(this.device.SetPointTemp);
         //        that.log("Device type is: " + this.model + ". Target temperature should be there.");
		if (this.debug) {
			that.log("Target temperature for", this.name, "is", targetTemperature + "°C");
		}
        if (targetTemperature < 10)
            targetTemperature = 10;

        if (targetTemperature > 38)
            targetTemperature = 38;
        callback(null, Number(targetTemperature));

    },

    getTemperatureDisplayUnits: function(callback) {
        callback(null, Number(1));
    },

    getServices: function() {
        var that = this;
        that.log("getServices", this.device.Room);
        // Information Service
        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
			.setCharacteristic(Characteristic.Model, "Signature")
			.setCharacteristic(Characteristic.FirmwareRevision, this.device.SWVersion)
            .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);
        // Thermostat Service
        this.thermostatService = new Service.Thermostat(this.device.Room);
		
        // Required Characteristics /////////////////////////////////////////////////////////////
        // this.addCharacteristic(Characteristic.CurrentHeatingCoolingState); READ
        this.thermostatService
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this));
			
        // this.addCharacteristic(Characteristic.TargetHeatingCoolingState); READ WRITE
        this.thermostatService
			.getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.setProps({
				validValues: [0, 1]
            })
			.on('get', this.getTargetHeatingCooling.bind(this))
            .on('set', this.setTargetHeatingCooling.bind(this));

		
        // this.addCharacteristic(Characteristic.CurrentTemperature); READ
        this.thermostatService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100
            })
            .on('get', this.getCurrentTemperature.bind(this));

        // this.addCharacteristic(Characteristic.TargetTemperature); READ WRITE
        this.thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minStep: 0.5
            })
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this));

        // this.addCharacteristic(Characteristic.TemperatureDisplayUnits); READ WRITE
        this.thermostatService
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this));

        // Optional Characteristics /////////////////////////////////////////////////////////////
        // this.addOptionalCharacteristic(Characteristic.CurrentRelativeHumidity);
        // this.addOptionalCharacteristic(Characteristic.TargetRelativeHumidity);
        // this.addOptionalCharacteristic(Characteristic.CoolingThresholdTemperature);
        // this.addOptionalCharacteristic(Characteristic.HeatingThresholdTemperature);   
        // this.addOptionalCharacteristic(Characteristic.Name);
        this.thermostatService
            .getCharacteristic(Characteristic.Name)
            .on('get', this.getName.bind(this));
        return [informationService, this.thermostatService];

    }
}
