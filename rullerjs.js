/**
 * RullerJS is an utility for listening to changes in ruller services
 * 
 * It will take the "input" parameters and send to a ruller URL and 
 * the resulting "output" from ruller will be notified by method "onOutput".
 * 
 * If the client application changes the input (setInput) it will resend the
 * request and, only if the output is different from previous notification,
 * will notify the changes using "onOutput"
 * 
 * It can monitor ruller for changes by pooling the endpoint automatically too using "startPooling()"
 */

class RullerJS {
    constructor(rullerURL, input, cacheMillis, onChange, onErr) {
        if (!rullerURL) {
            throw "rullerURL is required"
        }
        if (!onChange) {
            throw "onOutput is required"
        }
        this.rullerURL = rullerURL
        this.onChange = onChange
        this.onErr = onErr
        this.input = input

        this.previousData = null
        this.cacheMillis = cacheMillis

        this.rullerWSURL = null
        this.backoffMinMillis = null
        this.backoffMaxMillis = null
        this.maxRetryIntervalMillis = null

        this.retryCount = 0
        this.retryWaitTime = null
        this.currentTimer = null

        if(cacheMillis == 0) {
            localStorage.removeItem("rullerjs:lastData")
        }

        this.poll(false);
    }

    startMonitoring(rullerWSURL, backoffMinMillis, backoffMaxMillis, maxRetryIntervalMillis) {
        if(!backoffMinMillis) {
            backoffMinMillis = 2000
        }
        if(!backoffMaxMillis) {
            backoffMaxMillis = 20000
        }
        this.rullerWSURL = rullerWSURL
        this.backoffMinMillis = backoffMinMillis
        this.backoffMaxMillis = backoffMaxMillis
        this.maxRetryIntervalMillis = maxRetryIntervalMillis
        this.schedule(null, true)
    }

    stopMonitoring() {
        if(this.currentTimer!=null) {
            clearTimeout(this.currentTimer)
            this.currentTimer = null
        }
        this.rullerWSURL = null
        this.backoffMinMillis = null
        this.backoffMaxMillis = null
        this.maxRetryIntervalMillis = null
        if(this.ws!=null) {
            this.ws.close()
            this.ws = null
        }
    }

    poll(applySchedule) {
        if(applySchedule) {
            this.currentTimer = null
        }

        fetch(this.rullerURL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.input)

        }).then((response) => {
            if(response.status!=200) {
                this.schedule("Error fetching " + this.rullerURL + ". status=" + response.status, applySchedule)
                return
            }
            
            response.json()
            .then((data) => {
                // console.log("RullerJS: got response: " + data)
                let ndata = JSON.stringify(data)
                if(this.cacheMillis>0) {
                    localStorage.setItem("rullerjs:lastData", JSON.stringify({time:new Date().getTime(), data: data}))
                }
                if(this.previousData == null || (JSON.stringify(this.previousData) != ndata)) {
                    console.log("RullerJS flags: " + ndata);
                    this.onChange(data)
                    this.previousData = data
                }
                this.schedule(null, applySchedule)
            }).catch((err) => {
                this.schedule(err, applySchedule)
            });

        }).catch((err) => {
            this.schedule("Error fetching " + this.rullerURL + ". err=" + err, applySchedule)
        })
    }

    setInput(input) {
        this.input = input
        this.poll(false)
    }

    schedule(lastErr, applySchedule) {

        if(lastErr) {
            console.log("RullerJS: " + lastErr)
            if(this.onErr) {
                this.onErr(lastErr)
            }
            this.notifyIfValidCache()
        }

        //LOCALSTORAGE CACHE
        if(!applySchedule) {
            return
        }

        if(this.rullerWSURL == null) {
            return
        }

        if(this.currentTimer) {
            console.log("RullerJS: skipping overlapped schedule")
            return
        }

        if(lastErr) {
            this.retryCount++
        } else {
            if(this.retryCount>0) {
                console.log("RullerJS: connection restored")
            }
            this.retryCount = 0
            this.retryWaitTime = null
        }

        //RETRY FROM FAILURE
        //define first retry random backoff to avoid too much pressure on server when
        //it restarts so that not all clients would connect back at the same time
        if(this.retryCount > 0) {
            if(this.retryCount == 1) {
                // console.log("Random backoff retry delay")
                this.retryWaitTime = getRandomIntInclusive(this.backoffMinMillis, this.backoffMaxMillis)
            } else if(this.retryCount == 2) {
                // console.log("retryCount==2")
                this.retryWaitTime = this.backoffMinMillis
            } else {
                // console.log("retryCount>2")
                this.retryWaitTime = Math.min(this.retryWaitTime * 2, this.maxRetryIntervalMillis)
            }
            console.log("RullerJS: Retrying in " + this.retryWaitTime + "ms")
            if(this.retryWaitTime>=1000) {
                this.currentTimer = setTimeout(() => this.poll(true), this.retryWaitTime)
            }
            return
        }

        //MONITOR WS CLOSED
        if(this.rullerWSURL != null) {
            var ws = new WebSocket(this.rullerWSURL);
            ws.onopen = () => {
                // console.log("RullerJS: connected to " + this.rullerWSURL)
            };
            ws.onclose = (err) => {
                this.schedule("websocket closed. err=" + err, true)
            };
            ws.onerror = (err) => {
              this.schedule("websocket err=" + err, true)
              ws.close()
            };
            this.ws = ws
        }
    }

    notifyIfValidCache() {
        if(this.cacheMillis==0) {
            return
        }
    
        let cachedData = localStorage.getItem("rullerjs:lastData")
        if(cachedData==null) {
            return
        }
    
        let lcache = null
        try {
            lcache = JSON.parse(cachedData)
        } catch (err) {
            console.log("RullerJS: error parsing localstorage cache data. err=" + err)
            return
        }
    
        if(lcache.data==null || lcache.time==null) {
            return
        }
    
        let elapsedCache = (new Date().getTime()-lcache.time)
        if(!(elapsedCache <= this.cacheMillis)) {
            console.log("RullerJS: cache expired")
            localStorage.removeItem("rullerjs:lastData")
            lcache.data = null
        }
    
        if(this.previousData == null || (JSON.stringify(this.previousData) != JSON.stringify(lcache.data))) {
            console.log("RullerJS flags (cached): " + lcache.data);
            this.onChange(lcache.data)
            this.previousData = lcache.data
        }
    }
    
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

