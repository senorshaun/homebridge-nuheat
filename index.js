'use strict';
let NuHeatAPI = require('./lib/NuHeatAPI.js');
let NuHeatGroup = require('./lib/NuHeatGroup.js');
let NuHeatThermostat = require('./lib/NuHeatThermostat.js');
let NuHeatListener = require('./lib/NuHeatListener.js');
const logger = require("./lib/logger");
let Homebridge, PlatformAccessory, Service, Characteristic, UUIDGen;
module.exports = function (homebridge) {
    Homebridge = homebridge;
    PlatformAccessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform('homebridge-nuheat', 'NuHeat', NuHeatPlatform, true);
};
 
class NuHeatPlatform {
    constructor(log, config, api) {
        if (!config) {
            log.warn("Ignoring NuHeat Platform setup because it is not configured");
            this.disabled = true;
            return;
        }
        if (((!config.Email) && (!config.email)) || (!config.password)) {
            log.warn("Ignoring NuHeat Platform setup because it is not configured properly. Missing email or password");
            this.disabled = true;
            return;
        }
 
        this.config = config;
        this.config.email = this.config.Email || this.config.email;
        this.config.holdLength = Math.min(1440, Math.max(0, this.config.holdLength || 1440));
        this.api = api;
        this.accessories = [];
        this.log = new logger.Logger(log, this.config.debug || false);
        this.setupPlatform();
    }
    configureAccessory(accessory) {
        this.accessories.push({uuid: accessory.UUID, accessory: accessory});
    }
    async setupPlatform() {
        this.log.info("Logging into NuHeat...");
        this.NuHeatAPI = new NuHeatAPI(this.config.email, this.config.password, this.log);
        if (await this.NuHeatAPI.returnAccessToken()) {
            await this.setupGroups();
            await this.setupThermostats();
            this.cleanupRemovedAccessories();
            setInterval(this.refreshAccessories.bind(this), (this.config.refresh || 60) * 1000);
            this.NuHeatListener = new NuHeatListener(await this.NuHeatAPI.returnAccessToken(), this);
            this.NuHeatListener.connect();
            //Disconnect cleaning when homebridge is shutting down
            process.on("SIGINT", function() {this.NuHeatListener.disconnect()}.bind(this));
            process.on("SIGTERM", function() {this.NuHeatListener.disconnect()}.bind(this));
        } else {
            this.log.error("Unable to acquire an access token. We will try again later.")
            setTimeout(this.setupPlatform.bind(this), (this.config.refresh || 60) * 1000);
        }  
    }
 
    async setupGroups() {
 
        let groupArray = this.config.groups || [];
        if (this.config.autoPopulateAwayModeSwitches || groupArray.length > 0) {
            let response = await this.NuHeatAPI.refreshGroups();
            if (!response) {
                this.log.error("Error getting data from NuHeatAPI");
            } else {
                if (groupArray.length == 0) {
                    this.log.info("No groups defined in config. Auto populating away mode wwitches by pulling all groups from the account.")
                }
                await Promise.all(
                    response.map((deviceData) => {
                        if ((groupArray.length == 0) || (groupArray.find(device => device.groupName == deviceData.groupName && !device.disabled))) {
                            var uuid = UUIDGen.generate(deviceData.groupId.toString());
                            let deviceAccessory = false;
                            if (this.accessories.find(accessory => accessory.uuid === uuid)){
                                deviceAccessory = this.accessories.find(accessory => accessory.uuid === uuid).accessory;
                            }
                            if (!deviceAccessory) {
                                this.log.info("Creating new away mode switch", deviceData.groupName);
                                let accessory = new PlatformAccessory(deviceData.groupName, uuid);
                                let deviceService = accessory.addService(Service.Switch, deviceData.groupName + " Away Mode");
                                this.api.registerPlatformAccessories("homebridge-nuheat", "NuHeat", [accessory]);
                                deviceAccessory = accessory;
                                this.accessories.push({uuid: uuid});
                            }
                            this.accessories.find(accessory => accessory.uuid === uuid).accessory = new NuHeatGroup(this.log, deviceData, (deviceAccessory instanceof NuHeatGroup ? deviceAccessory.accessory : deviceAccessory), this.NuHeatAPI, Homebridge);
                            this.accessories.find(accessory => accessory.uuid === uuid).existsInConfig = true;
                            this.log.info("Loaded away mode switch", deviceData.groupName);
                            this.accessories.find(accessory => accessory.uuid === uuid).accessory.updateValues(deviceData);
                        }
                    })
                );
            }
        }
    }
 
    async setupThermostats() {
        let deviceArray = this.config.devices || [];
        let response = await this.NuHeatAPI.refreshThermostats();
        if (!response) {
            this.log.error("Error getting data from NuHeatAPI");
        } else {
            if (deviceArray.length == 0) {
                this.log.info("No devices defined in config. Auto populating thermostats by pulling everything from the account.")
            }
            await Promise.all(
                response.map((deviceData) => {
                    if ((deviceArray.length == 0) || (deviceArray.find(device => device.serialNumber == deviceData.serialNumber && !device.disabled))) {
                        var uuid = UUIDGen.generate(deviceData.serialNumber.toString());
                        let deviceAccessory = false;
                        if (this.accessories.find(accessory => accessory.uuid ===uuid)){
                            deviceAccessory = this.accessories.find(accessory => accessory.uuid === uuid).accessory;
                        }
                        if (!deviceAccessory) {
                            this.log.info("Creating new thermostat for serial number: " + deviceData.serialNumber);
                            let accessory = new PlatformAccessory(deviceData.name, uuid);
                            let deviceService = accessory.addService(Service.Thermostat, deviceData.name);
                            this.api.registerPlatformAccessories("homebridge-nuheat", "NuHeat", [accessory]);
                            deviceAccessory = accessory;
                            this.accessories.push({uuid: uuid});
                        }
                        this.accessories.find(accessory => accessory.uuid === uuid).accessory = new NuHeatThermostat(this.log, deviceData, this.config.holdLength, (deviceAccessory instanceof NuHeatThermostat ? deviceAccessory.accessory : deviceAccessory), this.NuHeatAPI, Homebridge);
                        this.accessories.find(accessory => accessory.uuid === uuid).existsInConfig = true;
                        this.log.info("Loaded thermostat " + deviceData.serialNumber + " " +deviceData.name);
                        this.accessories.find(accessory => accessory.uuid ===uuid).accessory.updateValues(deviceData);
                    }
                })
            );
        }
    }

    cleanupRemovedAccessories() {
        // Iterate over all accessories in the dictionary, and anything without the flag needs to be removed
        this.accessories.forEach(function(thisAccessory) {
            if (thisAccessory.existsInConfig !== true) {
                try {
                    this.log.info("Deleting removed accessory", thisAccessory.accessory.getService(Service.AccessoryInformation).getCharacteristic(Characteristic.Name).getValue());
                } catch {
                    this.log.info("Deleting removed accessory");
                }
                this.api.unregisterPlatformAccessories(undefined, undefined, [thisAccessory.accessory]);
               
            }
        },this);
    }
 
    async refreshAccessories() {
       await this.refreshGroups();
       await this.refreshTheromstats();
    }
 
    async refreshGroups() {
        this.log.debug("Trying to refresh groups.");
        let response = await this.NuHeatAPI.refreshGroups();
        if (!response) {
            this.log.error("Error getting data from NuHeatAPI in group refresh");
            return false;
        } else {
                response.forEach(function(deviceData) {
                    let thisAccessory = this.accessories.find(accessory => accessory.uuid === UUIDGen.generate(deviceData.groupId.toString()));
                    if (thisAccessory) {
                        thisAccessory.accessory.updateValues(deviceData);
                    }
                }, this);
                return true;
        }
    }
 
    async refreshTheromstats() {
        this.log.debug("Trying to refresh thermostats.");
        let response = await this.NuHeatAPI.refreshThermostats();
        if (!response) {
            this.log.error("Error getting data from NuHeatAPI in thermostat refresh");
            return false;
        } else {
            response.forEach(function(deviceData) {
                let thisAccessory = this.accessories.find(accessory => accessory.uuid === UUIDGen.generate(deviceData.serialNumber.toString()));
                if (thisAccessory) {
                    thisAccessory.accessory.updateValues(deviceData);
                }
            }, this);
            return true;
        }
    }
}