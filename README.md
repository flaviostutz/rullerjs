# rullerjs

A client for change detection of feature flags for Ruller

See a very simple demo at https://youtu.be/ScWwz1zUasI

## Usage

* Run a sample ruller container with some rules

```sh
git clone https://github.com/flaviostutz/ruller-sample-feature-flag
cd ruller-sample-feature-flag
docker-compose up --build -d
```

* Register RullerJS for invoking feature flag service and keep it up with changes by polling the service each 1s (bad for scalling!)

```js
let input = {customerid: "123"}
r = new RullerJS("http://127.0.0.1:8080/rules/domains", 
    input,
    0,
    (output) => {
        console.log("OUTPUT CHANGED: " + JSON.stringify(output))
        document.getElementById("status").innerText = JSON.stringify(output)
    }, (err) => {
        console.log("ERROR: " + err)
    });
r.startPolling(1000)
```

* Register RullerJS for invoking feature flag service and keep it up with changes by monitoring a webservice (great for scale but requires an environment that supports websockets). When the ws closes, it will try to get newer flags.

```js
let input = {customerid: "123"}
r = new RullerJS("http://127.0.0.1:8080/rules/domains",
    input,
    0,
    (output) => {
        console.log("OUTPUT CHANGED: " + JSON.stringify(output))
        document.getElementById("status").innerText = JSON.stringify(output)
    }, (err) => {
        console.log("ERROR: " + err)
    });
r.startMonitoring("ws://127.0.0.1:8080/ws")
```

## API

### new RullerJS(rullerURL, inputData, cacheSeconds, onChange, onErr)

* Instantiates a new RullerJS service. RullerJS will issue a POST request to the ruller endpoint with "inputData" and if there is an outputData available, will call onChange(data). After instantiation it won't start polling or monitoring automatically. You have to call startPolling() or startMonitoring() for this to happen.

* *rullerURL* - The full URL for the ruller service. ex.: "http://myflags.site.com/rules/domains"

* *inputData* - object with plain data used as input for feature flag evaluation. Ex: `{customerid:"123456abc"}`

* *cacheSeconds* - if > 0, will reuse the last successful outputData among page reloads while the ruller service is down. Useful to avoid the user to see the "default" page configurations while the flag service is down for a short time. The cached outputData is stored in localStorage.

* *onChange* - callback function called when there is a useful outputData from flag service. It will be called when the contents of the flag service output is changed or when it is the first invocation, the service is down, but the cache (in localStorage) is still valid.

* *onError* - callback function invoked when an error occurs during ruller service requests. Having an error here doesn't mean RullerJS will stop trying to reconnect if it is monitoring or polling the endpoint. If you want to stop trying, call RullerJS.stopMonitoring() or RullerJS.stopPolling().


### RullerJS.startMonitoring(rullerWSURL, randomBackoffMaxMillis, maxRetryIntervalMillis)

* Useful for detecting ruller service changes without the need to poll the service periodically. This will start monitoring a Websocket endpoint and if it is closed, will retry connecting to the ruller service to get newer data.

* *rullerWSURL* - Websocket URL used for monitoring "closes". Ex.: "ws://myflags.site.com/ws". Use the same ruller websocket service as the POST service so that when your service is restarted, the new configurations will be fetched.

* *randomBackoffMaxMillis* - When trying to reconnect to the ruller service, wait for a random time at the first retry so that the not all clients will execute a DDoS on servers. This value defines the max time in randomization.

* *maxRetryIntervalMillis* - At each failed retry, the time to wait before trying again will double. This is the max time to wait before retrying, limiting the "doubling".

### RullerJS.stopMonitoring()

* Close websocket and cancel all monitoring activities of the ruller service. Changes in ruller service won't affect the client anymore.

