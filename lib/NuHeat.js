/*jslint node: true */
'use strict';

var Q = require('q');
var request = require('request');
var jar = request.jar();
var _ = require('lodash');
var parseString = require('xml2js').parseString;
var Characteristic;
var debug = false;
var ldebug = false;   // debugging of login errors - too verbose
var sessionID;

var sessionCredentials = {};

function Session(Email, password, appId) {
    sessionCredentials[this.sessionID] = {
        Email: Email,
        password: password,
        appId: appId
    };
}

Session.prototype.CheckDataSession = function(deviceID, cb) {
    
	var url = "https://www.mynuheat.com/api/thermostat?sessionid=" + sessionID + "&serialnumber=" + deviceID;
    this._request(url).then(function(json) {
        cb(null, json);
    }.bind(this)).fail(function(err) {
        console.log('CDS Failed:', err);
        cb(err);
    });
}

Session.prototype.setHeatSetpoint = function(deviceID, heatSetPoint) {
    var deferred = Q.defer();
    var url = "https://www.mynuheat.com/api/thermostat?sessionid=" + sessionID + "&serialnumber=" + deviceID;
    if (debug)
        console.log("setHeatSetpoint", heatSetPoint);

    request({
        method: 'POST',
        url: url,
        jar: jar,
        timeout: 15000,
        strictSSL: false,
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'Keep-Alive',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json; charset=UTF-8',
            'DNT': 1,
            'Host': 'mynuheat.com',
            'Origin': 'https://mynuheat.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        },
        form: {
			"SetPointTemp": heatSetPoint,
			"ScheduleMode": "3"
		}
    }, function(err, response) {
        if (err || response.statusCode != 200 || response.statusMessage != "OK") {
            if (err) {
                console.log("Error: setHeatSetpoint",err);
            } else {
                console.log("Error ", response.statusCode);
                deferred.reject("HTTP Error ", response.statusCode);
            }
            deferred.reject(new Error("Error: setHeatSetpoint"));

        } else {
            var json;
            //    console.log(response.body);
            try {
                json = JSON.parse(response.body);
				console.log(json);
            } catch (ex) {
                //                console.error(ex);
                console.error(response.statusCode, response.statusMessage);
                console.error(response.body);
                //                console.error(response);
                deferred.reject(ex);
            }
            if (json) {
                deferred.resolve(json);
            }
        }
    });

    return deferred.promise;
}
Session.prototype.setSystemSwitch = function(deviceID, systemSwitch) {
    var deferred = Q.defer();
    var url = "https://www.mynuheat.com/api/thermostat?sessionid=" + sessionID + "&serialnumber=" + deviceID;

    if (debug)
        console.log("setSystemSwitch", systemSwitch);

    request({
        method: 'POST',
        url: url,
        jar: jar,
        strictSSL: false,
        headers: {
            "Accept": "*/*",
            "DNT": "1",
            "Accept-Encoding": "plain",
            "Cache-Control": "max-age=0",
            "Accept-Language": "en-US,en,q=0.8",
            "Connection": "keep-alive",
            "Host": "mynuheat.com",
            "Referer": "https://mynuheat.com/api/",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36"
        },
        form: {
        "OperatingMode": Number(systemSwitch)
    }
    }, function(err, response) {
        if (err || response.statusCode != 200 || response.statusMessage != "OK") {
            if (err) {
                console.error(err);
            } else {
                console.log("Error ", response.statusCode);
                deferred.reject("HTTP Error ", response.statusCode);
            }
            return err;

        } else {
            var json;
            //    console.log(response.body);
            try {
                json = JSON.parse(response.body);
            } catch (ex) {
                //                console.error(ex);
                console.error(response.statusCode, response.statusMessage);
                console.error(response.body);
                //                console.error(response);
                deferred.reject(ex);
            }
            if (json) {
                deferred.resolve(json);
            }
        }
    });

    return deferred.promise;
}

Session.prototype._request = function(url) {
    var deferred = Q.defer();
    request({
        method: 'GET',
        url: url,
        jar: jar,
        timeout: 15000,
        strictSSL: false,
        headers: {
            "Accept": "*/*",
            "DNT": "1",
            "Accept-Encoding": "plain",
            "Cache-Control": "max-age=0",
            "Accept-Language": "en-US,en,q=0.8",
            "Connection": "keep-alive",
            "Host": "mynuheat.com",
            "Referer": "https://mynuheat.com/api/",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36"
        }
    }, function(err, response) {
		if (err || response.statusCode != 200 || response.statusMessage != "OK") {
            if (err) {
                console.log("Error _request", url, err);
                deferred.reject(err);
            } else {
                console.log("Error _request", url, response.statusCode);
                deferred.reject("HTTP Error " + response.statusCode);
            }
            return err;

        } else {
            var json;
            //console.log("_request", url, response.body);
            try {
                json = JSON.parse(response.body);
            } catch (ex) {
                //                console.error(ex);
                console.error(response.statusCode, response.statusMessage);
                console.error(response.body);
                //                console.error(response);
                deferred.reject(ex);
            }
            if (json) {
                deferred.resolve(json);
            }
        }
    });

    return deferred.promise;
}

function login(Email, password) {
    var deferred = Q.defer();
    request({
        jar: jar,
        method: 'GET',
        url: 'https://www.mynuheat.com/',
        timeout: 10000,
        strictSSL: false,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Encoding": "sdch",
            "Host": "mynuheat.com",
            "DNT": "1",
            "Origin": "https://www.mynuheat.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36"
        },

    }, function(err, response) {
        // Response s/b 200 OK
        if (err || response.statusCode != 200) {
            console.log("NuHeat Login Failed, can't connect to NuHeat Web Site", err);
            deferred.reject("NuHeat Login failed, can't connect to NuHeat Web Site");
            return err;
        } else {
            if (ldebug) {
                console.log(response.statusCode);
                console.log(response.statusMessage);
                console.log("-------------------------------------------");
                console.log(response.headers);
                console.log("-------------------------------------------");
                console.log(response.body);
                console.log("-------------------------------------------");
            }
            request({
                jar: jar,
                method: 'POST',
                url: 'https://www.mynuheat.com/api/authenticate/user',
                timeout: 10000,
                strictSSL: false,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Encoding": "sdch",
                    "Host": "mynuheat.com",
                    "DNT": "1",
                    "Origin": "https://mynuheat.com/api",
                    "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36"
                },
                form: {
                    Email: Email,
                    password: password,
                    application: "0"
                }
            }, function(err, response) {
                // response s/b 200
                if (err || response.statusCode != 200) {
                    console.log("NuHeat Login Failed - POST", err);
                    if (response) console.log(response.statusCode);
                    deferred.reject("NuHeat Login failed, please check your credentials");
                    return err;

                } else {
                    if (ldebug) {
                        console.log(response.statusCode);
                        console.log(response.statusMessage);
                        console.log("-------------------------------------------");
                        console.log(response.headers);
                        console.log("-------------------------------------------");
                        console.log(response.body);
                        console.log("-------------------------------------------");
                    }
					parseString(response.body, function( err, jsonObj) {
						var jsonString = JSON.stringify(jsonObj.AuthenticateResultREST.SessionId);
						sessionID = (jsonString).substring(2, (jsonString).length - 2);
					});
					
					deferred.resolve(response.statusCode);
                }
            });
        }
    });

    return deferred.promise;
}

module.exports = {
    login: function(Email, password, appId) {
        return login(Email, password, appId).then(function(json) {
            return new Session(Email, password, appId, json);
        });
    }
};

// Utility Functions


module.exports.toNuHeatTemperature = function(temperature) {
	// homekit only deals with Celsius. NuHeat needs the temp as something weird. Convert to Farenheit and then Celsius
            return ((((temperature * 9 / 5) + 32) - 33) * 56 + 33).toFixed(0);

}

module.exports.toHBTemperature = function(temperature) {
    // homekit only deals with Celsius. NuHeat reports the temp as something weird. Convert to Farenheit and then Celsius
	return (((((temperature - 33) / 56) + 33) - 32) * 5 / 9).toFixed(1);
}

module.exports.toHomeBridgeHeatingCoolingSystem = function(heatingCoolingSystem) {
    switch (heatingCoolingSystem) {
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

module.exports.toNuHeatHeatingCoolingSystem = function(heatingCoolingSystem) {
    switch (heatingCoolingSystem) {
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

module.exports.isEmptyObject = function(obj) {
    var name;
    for (name in obj) {
        return false;
    }
    return true;
};

module.exports.diff = function(obj1, obj2) {
    var result = {};
    var change;
    for (var key in obj1) {
        if (typeof obj2[key] == 'object' && typeof obj1[key] == 'object') {
            change = module.exports.diff(obj1[key], obj2[key]);
            if (module.exports.isEmptyObject(change) === false) {
                result[key] = change;
            }
        } else if (obj2[key] != obj1[key]) {
            result[key] = obj2[key];
        }
    }
    return result;
};

module.exports.deepEquals = function(o1, o2) {
    return JSON.stringify(o1) === JSON.stringify(o2);
}

module.exports.setCharacteristic = function(data) {
    Characteristic = data;
}

module.exports.setDebug = function(data) {
    debug = data;
}
