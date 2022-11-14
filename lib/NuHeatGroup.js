let Characteristic, SwitchService;
module.exports = class NuHeatGroup {
    constructor(log, deviceData, debug, accessory, NuHeatAPI, homebridge) {
        Characteristic = homebridge.hap.Characteristic;
        SwitchService = homebridge.hap.Service.Switch;
        this.log = log;
        this.deviceData = deviceData;
        this.debug = debug;
        this.accessory = accessory;
        this.NuHeatAPI = NuHeatAPI;
      
        this.accessory
            .getService(homebridge.hap.Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
                .setCharacteristic(Characteristic.Model, "Signature")
                .setCharacteristic(Characteristic.SerialNumber, "Group " + this.deviceData.groupId);
        this.setupListeners();
        this.accessory.updateReachability(true);
    }
    
    setupListeners() {
        // this.addCharacteristic(Characteristic.TargetHeatingCoolingState); READ WRITE
        this.accessory
            .getService(SwitchService)
                .getCharacteristic(Characteristic.On)
                    .on('set', this.setAwayMode.bind(this));
    }
  
    // This is change the setpoint
    async setAwayMode(value, callback) {
 
        if (this.debug) {
            this.log("Setting %s away mode to %s", this.deviceData.groupName, value);
        }
        let response =  await this.NuHeatAPI.setAwayMode(this.this.deviceData.groupId, value);
        if (!response) {
            this.log.error("Error setting away mode for", this.deviceData.groupName);
            callback(new Error("Error: setAwayMode"));
        } else {
            this.updateValues(response);
            callback(null);
        }
    }

    async updateAccessory() {
        var response = await this.NuHeatAPI.refreshGroup(this.deviceData.groupId);
        if (!response) {
            this.log.error("Error getting updated data for", this.deviceData.groupName);
            this.accessory.updateReachability(false);
        } else {
            this.updateValues(response);
        }
    }

    updateValues(newValues) {
        this.accessory.updateReachability(true);
        if (newValues.awayMode) {
            if (this.debug) {
                this.log(this.deviceData.groupName + " is in away mode");
            }
            this.accessory
                .getService(SwitchService)
                    .getCharacteristic(Characteristic.On)
                        .updateValue(true);
        } else {
            if (this.debug) {
                this.log(this.deviceData.groupName + " is out of away mode");
            }
            this.accessory
                .getService(SwitchService)
                    .getCharacteristic(Characteristic.On)
                        .updateValue(false);
        }
        this.deviceData = newValues;
    }
}