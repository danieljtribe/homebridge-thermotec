const PLUGIN_NAME = "homebridge-thermotec";
const PLATFORM_NAME = "ThermotecRadiatorControl";

const { getConfiguration, getTemperaturesForZone, setTemperaturesForZone } = require('./utilties/sync.js');

module.exports = function(homebridge) {
  homebridge.registerPlatform(PLATFORM_NAME, TControl);
}

class TControl {
    constructor(log, config, api) {
        this.accessories = [];
        this.log = log;
        this.api = api;
        this.config = config;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        api.on('didFinishLaunching', async () => {
            log.info(PLATFORM_NAME + " platform 'didFinishLaunching'");

            const moduleConfig = await getConfiguration(config.host, config.port);

            for(let index = 0; index < Object.keys(moduleConfig.zones.modules).length; index++) {
                const zone = moduleConfig.zones.modules[Object.keys(moduleConfig.zones.modules)[index]];
                const zoneId = Object.keys(moduleConfig.zones.modules)[index];
                if(zone.quantity > 0) {
                    const uuid = this.api.hap.uuid.generate("Zone " + zoneId);
                    console.log("Accessory Zone", zoneId, uuid);

                    let existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
                    const accessory = existingAccessory ? existingAccessory : new this.api.platformAccessory(`Heating Zone ${zoneId}`, uuid);
                    new TThemrmostat(this, accessory, zoneId, zone.quantity, this.config.host, this.config.port);
                    if (existingAccessory) continue
                    this.accessories.push(accessory)
                    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                }
            }
        });
    }

    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }
}

class TThemrmostat {
    constructor(platform, accessory, zoneId, moduleCount, host, port) {
        this.platform = platform;
        this.accessory = accessory;
        this.zoneId = zoneId;
        this.moduleCount = moduleCount;
        this.host = host;
        this.port = port;

        this.hap = platform.api.hap;
        this.Service = this.hap.Service;
        this.Characteristic = this.hap.Characteristic;

        this.lastCurrentTemp = 10.0;
        this.lastTargetTemp = 10.0;

        this.configureAccessory();
    }

    async configureAccessory() {
        this.service = this.accessory.getService(this.Service.Thermostat) || this.accessory.addService(this.Service.Thermostat)

        this.service.getCharacteristic(this.hap.Characteristic.CurrentTemperature)
        .on('get', async (callback) => {
            callback(null, this.lastCurrentTemp);
            try {
                var current = await getTemperaturesForZone(this.host, this.port, this.zoneId);
                if(current && current.currentTemp) {
                    this.lastCurrentTemp = current.currentTemp;
                    this.lastTargetTemp = current.targetTemp;
                    this.service.getCharacteristic(this.hap.Characteristic.CurrentTemperature).updateValue(current.currentTemp);
                    this.service.getCharacteristic(this.hap.Characteristic.TargetTemperature).updateValue(current.targetTemp);
                }
            } catch(e) {
                console.error(e);
            }
        })

        this.service.getCharacteristic(this.hap.Characteristic.TargetTemperature)
        .on('get', async (callback) => {
            callback(null, this.lastTargetTemp);
            try {
                var current = await getTemperaturesForZone(this.host, this.port, this.zoneId);
                console.log(current);
                if(current && current.currentTemp) {
                    this.lastCurrentTemp = current.currentTemp;
                    this.lastTargetTemp = current.targetTemp;
                    this.service.getCharacteristic(this.hap.Characteristic.CurrentTemperature).updateValue(current.currentTemp);
                    this.service.getCharacteristic(this.hap.Characteristic.TargetTemperature).updateValue(current.targetTemp);

                    if(this.lastCurrentTemp < this.lastTargetTemp) {
                        this.service.getCharacteristic(this.hap.Characteristic.CurrentHeatingCoolingState).updateValue(this.Characteristic.CurrentHeatingCoolingState.HEAT);
                    } else {
                        this.service.getCharacteristic(this.hap.Characteristic.CurrentHeatingCoolingState).updateValue(this.Characteristic.CurrentHeatingCoolingState.OFF);
                    }
                }
            } catch(e) {
                console.error(e);
            }
        })
        .on('set', async (value, callback) => {
            callback(null);
            try {
                await setTemperaturesForZone(this.host, this.port, this.zoneId, this.moduleCount, value);
                this.lastTargetTemp = value;

                if(this.lastCurrentTemp < this.lastTargetTemp) {
                    this.service.getCharacteristic(this.hap.Characteristic.CurrentHeatingCoolingState).updateValue(this.Characteristic.CurrentHeatingCoolingState.HEAT);
                } else {
                    this.service.getCharacteristic(this.hap.Characteristic.CurrentHeatingCoolingState).updateValue(this.Characteristic.CurrentHeatingCoolingState.OFF);
                }
            } catch(e) {
                console.error(e);
            }
        });

        this.service.getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
        .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
        .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));
    }

    /**
     * Handle requests to get the current value of the "Temperature Display Units" characteristic
     */
    handleTemperatureDisplayUnitsGet() {
        console.debug('Triggered GET TemperatureDisplayUnits');

        // set this to a valid value for TemperatureDisplayUnits
        const currentValue = this.Characteristic.TemperatureDisplayUnits.CELSIUS;

        return currentValue;
    }

    /**
     * Handle requests to set the "Temperature Display Units" characteristic
     */
    handleTemperatureDisplayUnitsSet(value) {
        console.debug('Triggered SET TemperatureDisplayUnits:', value);
    }

    async setTargetTemperature(targetTemperature, callback) {
        return void callback();
    }
}