const dgram = require('node:dgram');

function sendRequest(host, port, messageText, retries=3, timeout=10) {
    const client = dgram.createSocket('udp4');
    let timer = null

    const message = new Buffer.from(`${messageText}/`);
    client.on('listening', function () {
        const address = client.address();
    });

    client.send(message, 0, message.length, port, host, function(err, bytes) {
        console.debug("SENT REQUEST:", message.toString());
        if (err) throw err;
    });

    return new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            retries--;
            if(retries>=0) {
                console.info("Retry:", retries+1);
                sendRequest(host, port, messageText, retries, timeout)
            } else {
                reject("TIMED_OUT");
            }
        }, timeout*1000);

        client.on('message', function (result, remote) {
            clearTimeout(timer);
            let response = (result.subarray(0, -1).toString('utf8')).split(',');
            console.debug("Received:",response);
            if(response[0] == 'OPOK' || response[0] == 'OK') {
                if(response[0] == 'OPOK') response.shift();response.shift();
                resolve(response);
            } else {
                console.error(response);
                reject("REQUEST_FAILED");
            }
        });
    });
}

module.exports = { sendRequest }