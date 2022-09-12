const { sendRequest } = require('../comms/udp.js');

async function getConfiguration(host, port) {
    try {
        const configuration = {
            "general": await sendRequest(host, port, "OPS1", 1, 5),
            "zones": await processZoneModuleResponse(await sendRequest(host, port, "OPS2", 1, 5), await sendRequest(host, port, "OPS3", 1, 5))
        };

        return configuration;
    } catch(e) {
        console.error("Unable to get configuration.");
    }
}

async function getTemperaturesForZone(host, port, zoneId) {
    try {
       const status = await sendRequest(host, port, `R#${zoneId}#1#0#0*?T`, 1, 30);
       return {
            'current': routeToHalf(parseFloat(`${status[0]}.${status[1]}`)),
            'target': parseFloat(`${convertValues(status[2])}`)
       }
    } catch(e) {
        console.error(`Unable to communicate with modules in zone ${zoneId}`, e);
        return {
            'current': false,
            'target': false
        };
    }
}

async function setTemperaturesForZone(host, port, zoneId, numberOfModules, temperatureCelcius) {
    try {
        if(temperatureCelcius != Math.floor(temperatureCelcius)) {
            // x.5
            temperatureCelcius = Math.floor(temperatureCelcius) + 128
        }
       return await sendRequest(host, port, `D#${zoneId}#${numberOfModules}#0#0*T${temperatureCelcius}`, 1, 30)
    } catch(e) {
        console.error(`Unable to communicate with all modules in zone ${zoneId}`, e);
        return null;
    }
}

function convertValues(input) {
    if(input >= 128) {
        input = input - (127.0 + 0.5);
    }
    return input;
}

function routeToHalf(input) {
    return Math.floor(input * 2)/2
}

async function processZoneModuleResponse(zones, modules) {
    const moduleList = {};
    zones.forEach((zone, index) => {
        moduleList[zone] = {
            'quantity': parseInt(modules[index], 10)
        }
    });

    return {
        modules: moduleList
    }
}

module.exports = { getConfiguration, getTemperaturesForZone  }