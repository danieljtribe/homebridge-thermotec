const PLUGIN_NAME = "homebridge-thermotec";
const PLATFORM_NAME = "ThermotecRadiatorControl";

const { getConfiguration, getTemperaturesForZone } = require('./utilties/sync.js');

module.exports = function(homebridge) {
  homebridge.registerPlatform(PLATFORM_NAME, TControl);
}

class TControl {
    constructor(log, config, api) {
        this.accessories = [];
        this.log = log;
        this.api = api;

        this.maxTemp = config.maxTemp || 30
        this.minTemp = config.minTemp || 15
        this.minStep = config.minStep || 0.5

        api.on('didFinishLaunching', async () => {
            log.info(PLATFORM_NAME + " platform 'didFinishLaunching'");
            this.loadModules(config.host, config.port);
        });
    }

    async loadModules(host, port) {
        getConfiguration(host, port).then(async moduleConfig => {
            for(let index = 0; index < Object.keys(moduleConfig.zones.modules).length; index++) {
                const zone = moduleConfig.zones.modules[Object.keys(moduleConfig.zones.modules)[index]];
                if(zone.quantity > 0) {
                    const uuid = this.api.hap.uuid.generate("Zone " + index);

                    const accessory = this.accessories.find(accessory => accessory.UUID === uuid);

                    if (!accessory) {
                        const accessory = new this.api.platformAccessory(`Heating Zone ${index+1}`, uuid);
                        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                    }

                    let service = accessory.getService(this.api.hap.Service.Thermostat) || accessory.addService(this.api.hap.Service.Thermostat);

                    service.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature).setProps({ minStep: this.minStep, minValue: this.minTemp, maxValue: this.maxTemp });
                    service.getCharacteristic(this.api.hap.Characteristic.TargetTemperature).setProps({ minStep: this.minStep, minValue: this.minTemp, maxValue: this.maxTemp });

                    service.getCharacteristic(this.api.hap.Characteristic.TargetHeatingCoolingState)
                    .setProps({
                        minValue: 0,
                        maxValue: 1,
                        validValues: [0,1]
                    });

                    let temperature = await getTemperaturesForZone(host, port, index+1);
                    if(!temperature.current || !temperature.target) {
                        service.updateCharacteristic(this.api.hap.Characteristic.CurrentTemperature, 15.0);
                        service.updateCharacteristic(this.api.hap.Characteristic.TargetHeatingCoolingState.CurrentHeatingCoolingState, this.api.hap.Characteristic.TargetHeatingCoolingState.CurrentHeatingCoolingState.OFF);
                    } else {
                        service.updateCharacteristic(this.api.hap.Characteristic.TargetHeatingCoolingState.CurrentHeatingCoolingState, this.api.hap.Characteristic.TargetHeatingCoolingState.CurrentHeatingCoolingState.HEAT);
                        service.updateCharacteristic(this.api.hap.Characteristic.TargetTemperature, temperature.target);
                        service.updateCharacteristic(this.api.hap.Characteristic.CurrentTemperature, temperature.current);
                    }
                }
            }
        });
    }

    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }

    async setTargetTemperature(targetTemperature, callback) {
        return void callback();
    }
}