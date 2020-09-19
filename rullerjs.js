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
    constructor(rullerURL, input, onChange, onErr) {
        if (!rullerURL) {
            throw "rullerURL is required"
        }
        if (!onChange) {
            throw "onOutput is required"
        }
        this.rullerURL = rullerURL;
        this.onChange = onChange;
        this.onErr = onErr;
        this.input = input;

        this.timerH = null;
        this.previousData = null;

        this.poll();
    }

    startPolling(intervalMillis) {
        this.timerH = setInterval(() => this.poll(), intervalMillis)
    }

    stopPolling() {
        clearInterval(this.timerH)
        this.timerH = null
    }

    poll() {
        let _self = this
        console.log("RullerJS: Polling ruller...")
        fetch(this.rullerURL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.input)

        }).then((response) => {
            if(response.status!=200) {
                console.log("RullerJS: Error fetching " + _self.rullerURL + ". status=" + response.status)
                if(_self.onErr) {
                    _self.onErr("Error fetching " + _self.rullerURL + ". status=" + response.status)
                }
                return
            }
            response.json().then(function(data) {
                console.log("RulleJS: got response: " + data)
                if(_self.previousData == null || (JSON.stringify(_self.previousData) != JSON.stringify(data))) {
                    console.log("Notifying client");
                    _self.onChange(data)
                    _self.previousData = data
                } else {
                    console.log("Ruller fetched but output is the same. Ignoring.")
                }
            });

        }, (err) => {
            const e = "Error fetching " + _self.rullerURL + ". err=" + err
            if(_self.onErr) {
                _self.onErr(e)
            } else {
                console.log(e)
            }

        }).catch((err) => {
            const e = "Error fetching " + _self.rullerURL + ". err=" + err
            if(_self.onErr) {
                _self.onErr(e)
            } else {
                console.log(e)
            }
        })
    }

    setInput(input) {
        this.input = input
        if(this.timerH==null) {
            this.poll()
        }
    }
    
}

