const cluster = require('cluster');
      
if (cluster.isMaster) {
    masterProcess();
} else {
    childProcess();
}

function masterProcess(){
    const http = require('http'),
        express = require('express'),
        bodyParser = require('body-parser'),
        coreCount=(require('os').cpus().length);
    const config={
        port:19000,
        maxMwM:14,
    };
    var counters={totalrequests:0,failedrequests:0, averagetime:0};
    // Fork workers
    var workers=[];
    var jobs=[];
    for (let i = 0; i < coreCount; i++) {
      var worker = cluster.fork();
      workers.push({handle:worker,jobs:0});
      // Listen for messages from worker
      worker.on('message', function(message) {
            //worker.process.pid
            // check if worker found better result
            if(message.success){
                counters.totalrequests += message.trytes.length;
                counters.averagetime = Math.floor(((counters.totalrequests - message.trytes.length) * counters.averagetime + (message.duration)) / counters.totalrequests); 
                jobs[message.job].res.send({trytes : message.trytes});
                jobs[message.job]=false;
                workers[message.worker].jobs--;
            } else {
                counters.totalrequests++;
                counters.failedrequests++;
                console.log(getPrintableTime()+" - Error performing PoW");
                console.log(message.result);
                jobs[message.job].res.send({trytes : false});
                jobs[message.job]=false;
                workers[message.worker].jobs--;
            }
      });
      worker.on('exit', (code, signal) => {
        if (signal==="SIGTERM") {
          console.log(getPrintableTime()+" - Worker "+worker.process.pid+" was killed!");
        } else if (signal) {
          console.log(getPrintableTime()+" - Worker "+worker.process.pid+" was killed by signal: "+signal);
        } else if (code !== 0) {
          console.log(getPrintableTime()+" - Worker "+worker.process.pid+" exited with error code: "+code);
        } else {
          console.log(getPrintableTime()+" - Worker "+worker.process.pid+" exited with code: "+code);  
        }
      });
    }
    console.log(getPrintableTime()+" - "+workers.length+" Workers started");
// spawn server
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
            let fields = req.body;
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
                var target=0;
                var jobcount=10000;
                for (var i = 0; i < workers.length; ++i) {
                    if(workers[i].jobs<jobcount){
                        target=i;
                        jobcount=workers[i].jobs;
                        if(workers[i].jobs==0){
                          i=workers.length;  
                        }
                    };
                }
                if(jobcount>10){
                    console.log("Jobcount critical!");
                }
                let curjob=jobs.length;
                jobs[curjob]={req:req,res:res};
                workers[target].jobs++;
                workers[target].handle.send({fields:fields,job:curjob,worker:target});                     
            }
        } else if(req.body.command=="getNeighbors"){
            res.send({neighbors: []})
        } else if(req.body.command=="powInfo"){
            res.send({total: counters.totalrequests,failed: counters.failedrequests, averagetime: counters.averagetime + 'ms'})
        } else {
            res.send({error: "Unknown command!"});
        }
    });
    http.createServer(server)
    .on('connection', function(socket) {
        socket.setTimeout(60000);
    })
    .listen(config.port, '0.0.0.0', () => {
        console.log(getPrintableTime()+" - Listening on port "+config.port);
    });
}


function childProcess() {
  const iotakeccak = require('iota.keccak.js');
  process.on('message', function(message) {
    // start work
    let startTime = Date.now();
    iotakeccak.doPoW(message.fields.trytes,message.fields.trunkTransaction,message.fields.branchTransaction,message.fields.minWeightMagnitude).
    then(function(result){
        if(!result.success){
            process.send({task:"pow",job:message.job,worker:message.worker,success:false,result:result,id: process.pid});
        } else {
            process.send({task:"pow",job:message.job,worker:message.worker,success:true,trytes:result.trytes, duration:(Date.now() - startTime),id: process.pid});
        }
    });
  });
}

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
