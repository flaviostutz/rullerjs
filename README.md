# rullerjs

A client for change detection of feature flags for Ruller

See a very simple demo at https://youtu.be/ScWwz1zUasI

## Usage

* Run a sample ruller container for some rules

```sh
git clone https://github.com/flaviostutz/ruller-sample-feature-flag
cd ruller-sample-feature-flag
docker-compose up --build -d
```

* Register RullerJS for invoking feature flag service and keepup with changes

```js
let input = {customerid: "123"}
r = new RullerJS("http://127.0.0.1:8080/rules/domains", 
    input, 
    (output) => {
        console.log("OUTPUT CHANGED: " + JSON.stringify(output))
        document.getElementById("status").innerText = JSON.stringify(output)
    }, (err) => {
        console.log("ERROR: " + err)
    });
r.startPolling(1000)
```

