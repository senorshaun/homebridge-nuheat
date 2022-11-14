let Characteristic, ThermostatService;
module.exports = class NuHeatThermostat {
    constructor(log, deviceData, debug, holdLength, accessory, NuHeatAPI, homebridge) {
        Characteristic = homebridge.hap.Characteristic;
        ThermostatService = homebridge.hap.Service.Thermostat;
        this.log = log;
        this.deviceData = deviceData;
        this.debug = debug;
        this.holdLength = holdLength;
        this.accessory = accessory;
        this.NuHeatAPI = NuHeatAPI;
      
        this.accessory
            .getService(homebridge.hap.Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
                .setCharacteristic(Characteristic.Model, "Signature")
                .setCharacteristic(Characteristic.SerialNumber, this.deviceData.serialNumber)
                .setCharacteristic(Characteristic.FirmwareRevision, this.deviceData.swVersion);
        this.setupListeners();
        this.accessory.updateReachability(true);
    }
    
    setupListeners() {
        // this.addCharacteristic(Characteristic.TargetHeatingCoolingState); READ WRITE
        this.accessory
            .getService(ThermostatService)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .setProps({
                        validValues: [0, 1]
                     })
                    .on('set', this.setTargetHeatingCooling.bind(this));
        // this.addCharacteristic(Characteristic.CurrentTemperature); READ
        this.accessory
            .getService(ThermostatService)
                .getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({
                        minValue: -100,
                       maxValue: 100
                    });
        // this.addCharacteristic(Characteristic.TargetTemperature); READ WRITE
        this.accessory
            .getService(ThermostatService)
                .getCharacteristic(Characteristic.TargetTemperature)
                    .setProps({
                        minStep: 0.5
                    })
                    .on('set', this.setTargetTemperature.bind(this));
    }
 
    // This is to change the system switch to a different mode - that doesn't work for us, its always in heat
    setTargetHeatingCooling(value, callback) {
        callback(null);
        this.updateAccessory();
    }
  
    // This is change the setpoint
    async setTargetTemperature(value, callback) {
        // maxValue = 38,
        // minValue = 10,
        this.log("Setting target temperature for", this.deviceData.name, "to", value + "°C");
        if (value < 10)
            value = 10;
        if (value > 38)
            value = 38;
        let heatSetPoint = this.toNuHeatTemperature(value);
        if (this.debug) {
            this.log("setTargetTemperature", this.deviceData.name, heatSetPoint);
        }
 
        let response =  await this.NuHeatAPI.setHeatSetpoint(this.deviceData.serialNumber, heatSetPoint, this.holdLength);
 
        if (!response) {
            this.log.error("Error setting target temperature for", this.deviceData.name);
            callback(new Error("Error: setTargetTemperature"));
        } else {
            this.updateValues(response);
            callback(null);
        }
    }

    async updateAccessory() {
        var response = await this.NuHeatAPI.refreshThermostat(this.deviceData.serialNumber);
        if (!response) {
            this.log.error("Error getting updated data for", this.deviceData.name);
        } else {
            this.updateValues(response);
        }
    }

    updateValues(newValues) {
        if (newValues.Online = "'True'") {
            this.accessory.updateReachability(true);
 
            // current temperature
            var currentTemperature = this.toHBTemperature(newValues.currentTemperature);
            if (this.debug) {
                this.log("Current temperature of " + this.deviceData.name + " is " + currentTemperature + "°C");
            }
            this.accessory
            .getService(ThermostatService)
                .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(currentTemperature);
 
            // setpoint temperature
            var setPointTemperature = this.toHBTemperature(newValues.setPointTemp);
            if (setPointTemperature < 10)
                setPointTemperature = 10;
            if (setPointTemperature > 38)
                setPointTemperature = 38;
            if (this.debug) {
                this.log("Setpoint temperature for", this.deviceData.name, "is", setPointTemperature + "°C");
            }
            this.accessory
                .getService(ThermostatService)
                    .getCharacteristic(Characteristic.TargetTemperature)
                        .updateValue(setPointTemperature);
 
            // currently isHeating
            var CurrentHeatingCoolingState = 0;
            if (newValues.isHeating) {
                CurrentHeatingCoolingState = 1;
            }
            if (this.debug) {
                this.log(this.deviceData.name, "current heating state is", CurrentHeatingCoolingState);
            }
            this.accessory
                .getService(ThermostatService)
                    .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                        .updateValue(CurrentHeatingCoolingState);
 
            // system switch mode
            var TargetHeatingCooling = this.toHomeBridgeisHeatingCoolingSystem(newValues.operatingMode);
            if (this.debug) {
                this.log(this.deviceData.name,"target heating state is", TargetHeatingCooling);
            }
            this.accessory
                .getService(ThermostatService)
                    .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                        .updateValue(TargetHeatingCooling);
        } else {
            if (this.debug) {
                this.log(this.deviceData.name, "seems to be offline according to NuHeat");
            }
            this.accessory.updateReachability(false);
        }
        this.deviceData = newValues;
    }

    // Utility Functions
    toNuHeatTemperature(temperature) {
        // homekit only deals with Celsius. NuHeat needs the temp as something weird. Convert to Farenheit and then Celsius
        return ((((temperature * 9 / 5) + 32) - 33) * 56 + 33).toFixed(0);
    }
 
    toHBTemperature(temperature) {
        // homekit only deals with Celsius. NuHeat reports the temp as something weird. Convert to Farenheit and then Celsius
        return (((((temperature - 33) / 56) + 33) - 32) * 5 / 9).toFixed(1);
    }
 
    toHomeBridgeisHeatingCoolingSystem(isHeatingCoolingSystem) {
        switch (isHeatingCoolingSystem) {
            case 0:
                // emergency heat
            case 1:
                // heat
                return Characteristic.TargetHeatingCoolingState.HEAT;
                break;
            case 2:
                // off
                return Characteristic.TargetHeatingCoolingState.OFF;
                break;
            case 3:
                // cool
            case 7:
                // "Drying" (MHK1)
                return Characteristic.TargetHeatingCoolingState.COOL;
                break;
            case 4:
                // autoheat
            case 5:
                // autocool
                return Characteristic.TargetHeatingCoolingState.AUTO;
                break;
            case 6:
                // "Southern Away" humidity control
            default:
                return Characteristic.TargetHeatingCoolingState.OFF;
        }
    }
 
    toNuHeatisHeatingCoolingSystem(isHeatingCoolingSystem) {
        switch (isHeatingCoolingSystem) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                // off
                return 2;
                break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
                // heat
                return 1
                break;
            case Characteristic.TargetHeatingCoolingState.COOL:
                // cool
                return 3
                break;
            case Characteristic.TargetHeatingCoolingState.AUTO:
                // auto
                return 4
                break;
            default:
                return 0;
        }
    }
}