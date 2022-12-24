let Characteristic, SwitchService;
module.exports = class NuHeatGroup {
    constructor(log, deviceData, accessory, NuHeatAPI, homebridge) {
        Characteristic = homebridge.hap.Characteristic;
        SwitchService = homebridge.hap.Service.Switch;
        this.log = log;
        this.deviceData = deviceData;
        this.accessory = accessory;
        this.NuHeatAPI = NuHeatAPI;
      
        this.accessory
            .getService(homebridge.hap.Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
                .setCharacteristic(Characteristic.Model, "Signature")
                .setCharacteristic(Characteristic.SerialNumber, "Group " + this.deviceData.groupId);
        this.setupListeners();
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
 
        this.log.debug("Setting %s away mode to " + value, this.deviceData.groupName);
        let response =  await this.NuHeatAPI.setAwayMode(this.this.deviceData.groupId, value);
        if (!response) {
            this.log.error("Error setting away mode", this.deviceData.groupName);
            callback(new Error("Error: setAwayMode"));
        } else {
            this.updateValues(response);
            callback(null);
        }
    }

    async updateAccessory() {
        var response = await this.NuHeatAPI.refreshGroup(this.deviceData.groupId);
        if (!response) {
            this.log.error("Error getting updated data", this.deviceData.groupName);
        } else {
            this.updateValues(response);
        }
    }

    updateValues(newValues) {
        if (newValues.awayMode) {
            this.log.debug("In away mode", this.deviceData.groupName);
            this.accessory
                .getService(SwitchService)
                    .getCharacteristic(Characteristic.On)
                        .updateValue(true);
        } else {
            this.log.debug("Out of away mode", this.deviceData.groupName);
            this.accessory
                .getService(SwitchService)
                    .getCharacteristic(Characteristic.On)
                        .updateValue(false);
        }
        this.deviceData = newValues;
    }
}