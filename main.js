const http = require('http'),
    express = require('express'),
    bodyParser = require('body-parser'),
    iotakeccak = require('iota.keccak.js');   
      
const config={
    port:19000,
    maxMwM:14,
};

var totalrequests = 0
var averagetime = 0

const server = express();
server.disable('x-powered-by');
server.set('etag', false);
server.use(bodyParser.json());
server.use(function(req, res){
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Methods", "POST")
    if(req.body.command=="getNodeInfo"){
        res.send({
          appName: "iota.keccak.pow.node.js",
          appVersion: "0.0.1",
          duration: 1
        })
    } else if(req.body.command=="attachToTangle"){
        doPoW(req, res);
    } else if(req.body.command=="getNeighbors"){
        res.send({neighbors: []})
    } else if(req.body.command=="powInfo"){
        res.send({total: totalrequests, averagetime: averagetime + 'ms'})
    } else {
        res.send({error: "Unknown command!"});
    }
  });

function doPoW(req, res){
    let startTime = Date.now()
    let fields = req.body
    fields.minWeightMagnitude=parseInt(fields.minWeightMagnitude);
    if(fields.minWeightMagnitude > config.maxMwM || fields.minWeightMagnitude < 1){
        res.send({error: "MwM of " + fields.minWeightMagnitude + " is invalid or over max of " + config.maxMwM});
    } else if(!fields.trunkTransaction.match(/^[A-Z9]{81}$/)){
        res.send({error: "Invalid trunk transaction"});
    } else if(!fields.branchTransaction.match(/^[A-Z9]{81}$/)){
        res.send({error: "Invalid branch transaction"});
    } else if(!checkTrytes(fields.trytes)){
        res.send({error: "Invalid trytes provided"});
    } else {
        iotakeccak.doPoW(fields.trytes,fields.trunkTransaction,fields.branchTransaction,fields.minWeightMagnitude).
        then(function(result){
            totalrequests += result.trytes.length;
            averagetime = Math.floor(((totalrequests - result.trytes.length) * averagetime + (Date.now() - startTime)) / totalrequests); 
            if(!result.success){
                console.log(getPrintableTime()+" - Error performing PoW");
                console.log(result);
                res.send({trytes : false});
            } else {
                res.send({trytes : result.trytes});
            }
        });
    }	
}

http.createServer(server)
.on('connection', function(socket) {
    socket.setTimeout(60000);
})
.listen(config.port, '0.0.0.0', () => {
    console.log(getPrintableTime()+" - Listening on port "+config.port);
});

function checkTrytes(trytes){
    if((trytes instanceof Array)!==true) return false;
    for (var i = 0, max = trytes.length; i < max; i++) {
       if(!trytes[i].match(/^[A-Z9]{2673}$/)) return false; 
    }
    return true;
}

function getPrintableTime(){
    // simple timestamp printer
    var currentdate = new Date(); 
    return ("0"+currentdate.getHours()).slice(-2) + ":"  
                    + ("0"+currentdate.getMinutes()).slice(-2) + ":" 
                    + ("0"+currentdate.getSeconds()).slice(-2);
}
