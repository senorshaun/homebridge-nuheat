'use strict';
const {default: fetch, FetchError, Headers, RequestInfo, RequestInit, Response, isRedirect } = require('node-fetch-cjs');
const {parse} = require ("node-html-parser");
 
const { NUHEAT_API_CLIENT_ID, NUHEAT_API_CLIENT_SECRET, NUHEAT_API_REDIRECT_URI, NUHEAT_API_AUTHORIZE_URI, NUHEAT_API_TOKEN_URI, NUHEAT_API_CONSENT_URI} = require("./settings");

module.exports = class NuHeatAPI {
    constructor(email, password, log) {
        this.email = email;
        this.password = password;
        this.log = log;
        this.headers = new Headers();
        this.headers.set("Content-Type", "application/json");
        this.headers.set("Accept", "application/json");
    }
 
    // Set the away mode of a group
    async setAwayMode(groupId, awayMode) {
 
        // Set the URL for the put call
        const callURL = "https://api.mynuheat.com/api/v1/Group";
        
        // Create the request to change away mode.
        const callBody = '{"groupId": ' + groupId + ', "awayMode": ' + awayMode + '}';
        const callOptions = {
            body: callBody,
            method: "PUT"
        };
 
        let returnedData = await this.makeAPICall(callURL, callOptions);
        return (returnedData);
    };
 
    // Set the setpoint of a thermostat
    async setHeatSetpoint(serialNumber, setPointTemp, holdLength) {

        let scheduleMode = 3;
        let holdSetPointDateTime;
        if (holdLength < 1440) {
            scheduleMode = 2;
            if (holdLength > 0) {
                holdSetPointDateTime = (new Date(Date.now() + holdLength*60*1000).toISOString().split('.')[0]).toString() + 'Z';    
            }
        }
 
        // Set the URL for the put call
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat";
        
        /// Create the request to change setpoint
        let callBody = '{"serialNumber": "' + serialNumber + '","setPointTemp": ' + setPointTemp + ',"scheduleMode": ' + scheduleMode;
        if (holdSetPointDateTime) {
            callBody += ', "holdSetPointDateTime": "' + holdSetPointDateTime + '"';
        }
        callBody += '}';
        this.log.info(callBody);
        const callOptions = {
            body: callBody,
            method: "PUT"
        };
 
        let returnedData = await this.makeAPICall(callURL, callOptions);
        return (returnedData);
    };
 
    // get data for a group
    async refreshGroup(groupId) {
        // set the URL for the call
        const callURL = "https://api.mynuheat.com/api/v1/Group/" + groupId;
 
        let returnedData = await this.makeAPICall(callURL);
        return (returnedData);
    };
 
    // get data for all groups
    async refreshGroups() {
        // set the URL for the call
        const callURL = "https://api.mynuheat.com/api/v1/Group";
 
        let returnedData = await this.makeAPICall(callURL);
        return (returnedData);
    };
 
    // get data for a thermostat
    async refreshThermostat(serialNumber) {
        // set the URL for the call
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat/" + serialNumber;
 
        let returnedData = await this.makeAPICall(callURL);
        return (returnedData);
    };
 
    // get data for all thermostat
    async refreshThermostats() {
        // set the URL for the call
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat";
 
        let returnedData = await this.makeAPICall(callURL);
        return (returnedData);
    };
 
    async makeAPICall(callURL, callOptions = {}) {
 
        // Validate and potentially refresh our access token.
        if(!(await this.refreshAccessToken())) {
          return false;
        }
        // Execute the refresh token request.
        const response = await this.fetch(callURL, callOptions);
        if(!response) {
            this.log.debug("NuHeatAPI: Unable to make API call. Acquiring a new access token.");
            this.accessToken = null;
            return false;
        }
        let returnedData = await response.json();
        return(returnedData);
    };
 
    // Retrieve the NuHeat OAuth authorization page to prepare to login.
    async oauthGetAuthPage(){
 
        const authEndpoint = new URL(NUHEAT_API_AUTHORIZE_URI);
 
        // Set the response type.
        authEndpoint.searchParams.set("response_type", "code");
 
        // Set the client identifier.
        authEndpoint.searchParams.set("client_id", NUHEAT_API_CLIENT_ID);
 
        // Set the redirect URI to the github page.
        authEndpoint.searchParams.set("redirect_uri", NUHEAT_API_REDIRECT_URI);
 
        // Set the scope.
        authEndpoint.searchParams.set("scope", "openapi openid offline_access");

        // Let's begin the login process.
        const response = await this.fetch(authEndpoint.toString(), {
          redirect: "follow"
        });
        if(!response) {
          this.log.error("NuHeatAPI: Unable to access the OAuth authorization endpoint.");
          return null;
        }
 
        return response;
    };
 
    // Login to the NuHeat API, using the retrieved authorization page.
    async oauthLogin(authPage) {
 
        // Grab the cookie for the OAuth sequence. We need to deal with spurious additions to the cookie that gets returned by the NuHeat API.
        const cookie = this.trimSetCookie(authPage.headers.raw()["set-cookie"]);

        if (cookie) {
            // Parse the NuHeat login page and grab what we need.
            const htmlText = await authPage.text();
            const loginPageHtml = parse(htmlText);
     
            const requestVerificationToken = loginPageHtml.querySelector("input[name=__RequestVerificationToken]")?.getAttribute("value");
            const requestReturnURL = loginPageHtml.querySelector("input[name=ReturnUrl]")?.getAttribute("value");
     
            if(!requestVerificationToken) {
               this.log.error("NuHeatAPI: Unable to complete OAuth login. The verification token could not be retrieved.");
                return null;
            }
     
            // Set the login info.
            const loginBody = new URLSearchParams({ "ReturnUrl": requestReturnURL, "Username": this.email, "Password": this.password, button: "login", "__RequestVerificationToken": requestVerificationToken });
            // Login and we're done.
            const response = await this.fetch(authPage.url, {
                body: loginBody.toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": cookie
                },
                method: "POST",
                redirect: "manual"
            });
     
            // An error occurred and we didn't get a good response.
            if(!response) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. Ensure your username and password are correct.");
                return null;
            }
     
            // If we don't have the full set of cookies we expect, the user probably gave bad login information.
            if(response.headers && response.headers.raw()["set-cookie"] && response.headers.raw()["set-cookie"].length < 2) {
                this.log.error("NuHeatAPI: Invalid NuHeat credentials given. Check your login and password.");
                return null;
            }
            return response;
        } else {
            return false;
        }
    };
 
    // Confirm homebridge-nuheat access to account
    async oauthConfirm(authPage, sessionCookie) {
 
        // Get the location for the redirect for later use.
        let redirectUrl = new URL(authPage.headers.get("location"), authPage.url);
 
        // Execute the redirect with the cleaned up cookies and we're done.
        let confirmPage = await this.fetch(redirectUrl.toString(), {
            headers: {
                "Cookie": sessionCookie
            }
        });
        if(!confirmPage) {
            this.log.error("NuHeatAPI: Unable to complete the OAuth login redirect.");
         }
        // Grab the cookie for the OAuth sequence. We need to deal with spurious additions to the cookie that gets returned by the NuHeat API.
        let cookie = this.trimSetCookie(confirmPage.headers.raw()["set-cookie"]);

        if(cookie) {
     
            // Parse the NuHeat login page and grab what we need.
            const htmlText = await confirmPage.text();
            const loginPageHtml = parse(htmlText);
     
            const requestVerificationToken = loginPageHtml.querySelector("input[name=__RequestVerificationToken]")?.getAttribute("value");
            const requestReturnURL = loginPageHtml.querySelector("input[name=ReturnUrl]")?.getAttribute("value");
     
            if(!requestVerificationToken) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. The api access couldn't be confirmed.");
                return null;
            }
     
            // Set the login info.
            const loginBody = new URLSearchParams({ "ReturnUrl": requestReturnURL, "button": "yes", "RememberConsent": "true", "__RequestVerificationToken": requestVerificationToken });
     
            // Login and we're done.
            let response = await this.fetch(NUHEAT_API_CONSENT_URI, {
                body: loginBody.toString() + "&ScopesConsented=openid&ScopesConsented=openapi&ScopesConsented=offline_access",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": cookie + '; ' + sessionCookie
                },
                method: "POST",
                redirect: "manual"
            });
     
            // An error occurred and we didn't get a good response.
            if(!response) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. API access confirmation not completed.");
                return null;
            }
     
            return response;
        } else {
            return false;
        }
    };
 
    // Intercept the OAuth login response to adjust cookie headers before sending on it's way.
    async oauthRedirect(loginResponse, sessionCookie) {
 
        // Get the location for the redirect for later use.
        const redirectUrl = new URL(loginResponse.headers.get("location"), NUHEAT_API_AUTHORIZE_URI);
 
        // Cleanup the cookie so we can complete the login process by removing spurious additions
        // to the cookie that gets returned by the NuHeat API.
        const cookie = this.trimSetCookie(loginResponse.headers.raw()["set-cookie"]);

        if(cookie) {
     
            // Execute the redirect with the cleaned up cookies and we're done.
            const response = await this.fetch(redirectUrl.toString(), {
                headers: {
                    "Cookie": cookie + '; ' + sessionCookie
                },
                redirect: "manual"
            });
            if(!response) {
                this.log.error("NuHeatAPI: Unable to complete the OAuth login redirect.");
                return null;
            }
            return response;
        } else {
            return false;
        }
    };
 
    // Get a new OAuth access token.
    async getAccessToken() {
 
        // Call the NuHeat authorization endpoint to get the web login page.
        let response = await this.oauthGetAuthPage();
 
        if(!response) {
            return null;
        }
 
        // Attempt to login.
        response = await this.oauthLogin(response);
 
        if(!response) {
            return null;
        }
 
        // Grab the session cookie being used so we can keep using it
        let sessionCookie = this.trimSetCookie(response.headers.raw()["set-cookie"]);

        if(sessionCookie) {
     
            if(response.headers && response.headers.get("location").startsWith('/connect/authorize/callback?')) {
                // Attempt to confirm api access.
                response = await this.oauthConfirm(response, sessionCookie);

                if(!response) {
                    return null;
                }
            }
     
            // Intercept the redirect back to localhost
            response = await this.oauthRedirect(response, sessionCookie);
            if(!response) {
                return null;
            }
     
            // Parse the redirect URL to extract the redirect url.
            const redirectUrl = new URL(response.headers.get("location") ?? "");
     
            // Create the request to get our access and refresh tokens.
            const requestBody = new URLSearchParams({
                "client_id": NUHEAT_API_CLIENT_ID,
                "client_secret": NUHEAT_API_CLIENT_SECRET,
                "code": redirectUrl.searchParams.get("code"),
                "grant_type": "authorization_code",
                "redirect_uri": NUHEAT_API_REDIRECT_URI,
                "scope": redirectUrl.searchParams.get("scope")
            });
     
            // Now we execute the final login redirect that will
            // return our access and refresh tokens.
            response = await this.fetch(NUHEAT_API_TOKEN_URI, {
                body: requestBody.toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method: "POST"
            });
     
            if(!response) {
                this.log.error("NuHeatAPI: Unable to acquire an OAuth access token.");
                return null;
            }
            // Grab the token JSON.
            this.tokenScope = redirectUrl.searchParams.get("scope") ?? "" ;
            
            // Return the access token
            return await response.json();
        } else {
            return false;
        }
    };
 
    // Refresh our OAuth access token.
    async getRefreshedAccessToken() {
 
        // Create the request to refresh tokens.
        const requestBody = new URLSearchParams({
            "client_id": NUHEAT_API_CLIENT_ID,
            "client_secret": NUHEAT_API_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "redirect_uri": NUHEAT_API_REDIRECT_URI,
            "refresh_token": this.refreshToken,
            "scope": this.tokenScope
        });
 
        // Execute the refresh token request.
        const response = await this.fetch(NUHEAT_API_TOKEN_URI, {
            body: requestBody.toString(),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            method: "POST"
        });
 
        if(!response) {
          return false;
        }
 
        // Grab the refresh token JSON.
        const token = await response.json();
        this.accessToken = token.access_token;
        this.accessTokenTimestamp = Date.now();
        this.refreshInterval = token.expires_in;
        this.refreshToken = token.refresh_token;
        this.tokenScope = token.scope ?? this.tokenScope;
        this.tokenType = taken.token_type;
 
        // Refresh our tokens at seven minutes before expiration as a failsafe.
        this.refreshInterval -= 420;
 
        // Ensure we never try to refresh more frequently than every five minutes.
        if(this.refreshInterval < 300) {
            this.refreshInterval = 300;
        }
 
        // Update our authorization header.
        this.headers.set("Authorization", token.token_type + " " + token.access_token);
        this.log.debug("NuHeatAPI: Successfully refreshed the NuHeat API access token.");
 
        // We're done.
        return true;
    };

    // Return access token if we have one. If not, get one now
    async returnAccessToken(){
 
        if(this.accessToken) {
            if((Date.now() - this.accessTokenTimestamp) > (this.refreshInterval * 1000) && (Date.now() - this.accessTokenTimestamp) < (1000*60*60*24*13.5)) {
                await this.getRefreshedAccessToken();
            }
        } else {
            await this.acquireAccessToken();
        }
        if(this.accessToken) {
            this.headers.set("Authorization", this.tokenType + " " + this.accessToken);
            return(this.accessToken);
        } else {
            return false;
        }
    };
 
    // Log us into NuHeat and get an access token.
    async acquireAccessToken(){
 
        let firstConnection = true;
 
        // Clear out tokens from prior connections.
        if(this.accessToken) {
            firstConnection = false;
            this.accessToken = null;
        }
 
        // Login to the NuHeat API and get an OAuth access token for our session.
        const token = await this.getAccessToken();
 
        if(!token) {
            return false;
        }
 
        // On initial plugin startup, let the user know we've successfully connected.
        if(firstConnection) {
            this.log.info("NuHeatAPI: Successfully connected to the NuHeat API.");
        } else {
            this.log.debug("NuHeatAPI: Successfully reacquired a NuHeat API access token.");
        }
 
        this.accessToken = token.access_token;
        this.accessTokenTimestamp = Date.now();
        this.tokenType = token.token_type;
        this.refreshInterval = token.expires_in;
        this.refreshToken = token.refresh_token;
        this.tokenScope = token.scope ?? this.tokenScope;

        // Add the token to our headers that we will use for subsequent API calls.
        this.headers.set("Authorization", this.tokenType + " " + this.accessToken);
 
        // Success.
        return true;
    };
 
    // Refresh the NuHeat API access token, if needed.
    async refreshAccessToken() {
 
        // If we don't have a access token yet, acquire one.
        if(!this.accessToken) {
            this.log.debug('NuHeatAPI: Acquiring new access token. Ours seems to be missing');
            return await this.acquireAccessToken();
        }
 
        // Is it time to refresh? If not, we're good for now.
        if((Date.now() - this.accessTokenTimestamp) < (this.refreshInterval * 1000)) {
            return true;
        }
        this.log.debug('NuHeatAPI: Acquiring new access token. Ours has expired or is expiring soon');
 
        // Try refreshing our existing access token before resorting to acquiring a new one.
        if(await this.getRefreshedAccessToken()) {
            return true;
        }
 
        this.log.error("NuHeatAPI: Unable to refresh our access token. " +
            "This error can usually be safely ignored and will be resolved by acquiring a new access token.");
 
        // Now generate a new access token.
        if(!(await this.acquireAccessToken())) {
                this.log.error('NuHeatAPI: Fatal error. We need a new access token didnt successfuly get one');
            return false;
        }
        return true;
    };
 
    // Utility to let us streamline error handling and return checking from the NuHeat API.
    async fetch(url, options = {}, decodeResponse = true, isRetry = false) {
        // Set our headers.
        if (!options.headers){
            options.headers = this.headers;
        }
        try {
            let response = await fetch(url, options);
            // The caller will sort through responses instead of us.
            if(!decodeResponse) {
                return response;
            }
            // Bad form data submitted.
            if(response.status === 400) {
                this.log.error("NuHeatAPI: Invalid call. Data submitted doesn't seem right");
                return null;
            // Bad username and password.
            } else if(response.status === 401) {
                this.log.error("NuHeatAPI: Invalid NuHeat credentials given. Check your login and password.");
                return null;
            // Error on the NuHeat side.
            } else if(response.status === 500) {
                this.log.error("NuHeatAPI: NuHeat had an internal server error.");
                if (isRetry){
                    return null;
                } else {
                    this.log.error("NuHeatAPI: Trying again.");
                    return this.fetch(url, options, decodeResponse, true);
                }
            }
            // Some other unknown error occurred.
            if(!response.ok && !isRedirect(response.status)) {
                this.log.error("NuHeatAPI: %s Error: %s %s", url, response.status, response.statusText);
                return null;
            }
            return response;
        } catch(error) {
            if(error instanceof FetchError) {
                switch(error.code) {
                    case "ECONNREFUSED":
                        this.log.error("NuHeatAPI: Connection refused.");
                        break;
                    case "ECONNRESET":
                        // Retry on connection reset, but no more than once.
                        if(!isRetry) {
                            this.log.debug("NuHeatAPI: Connection has been reset. Retrying the API action.");
                            return this.fetch(url, options, decodeResponse, true);
                        }
                        this.log.error("NuHeatAPI: Connection has been reset.");
                        break;
                    case "ENOTFOUND":
                        this.log.error("NuHeatAPI: Hostname or IP address not found.");
                        break;
                    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
                        this.log.error("NuHeatAPI: Unable to verify the NuHeat TLS security certificate.");
                        break;
                    default:
                        this.log.error(error.message);
                }
            } else {
                this.log.error("Unknown fetch error: %s", error);
            }
            return null;
        }
    }

    trimSetCookie(setCookie) {
        if(setCookie) {
            return setCookie.map(x => x.split(";")[0]).join("; ");
        } else {
            return false;
        }
    }
}