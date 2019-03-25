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
        ip:"0.0.0.0",
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
            if(message.success){
                counters.totalrequests += message.trytes.length;
                counters.averagetime = Math.floor(((counters.totalrequests - message.trytes.length) * counters.averagetime + (message.duration)) / counters.totalrequests); 
                jobs[message.job].res.send({trytes : message.trytes,"duration":(Date.now()-message.starttime)});
                jobs[message.job]=false;
                workers[message.worker].jobs--;
            } else {
                counters.totalrequests++;
                counters.failedrequests++;
                console.log(getPrintableTime()+" - Error performing PoW");
                console.log(message.result);
                res.status(500);
                jobs[message.job].res.send({trytes : false,"duration":(Date.now()-message.starttime)});
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
        var starttime=Date.now();
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Methods", "POST")
        if(req.body.command=="getNodeInfo"){
            res.send({
              appName: "iota.keccak.pow.node.js",
              appVersion: "0.0.1",
              duration: (Date.now()-starttime)
            })
        } else if(req.body.command=="attachToTangle"){
            let fields = req.body;
            if (typeof(fields.minWeightMagnitude)==="undefined"){
                res.status(400);
                res.send({error: "Invalid parameters","duration":(Date.now()-starttime)});
            } else {
                fields.minWeightMagnitude=parseInt(fields.minWeightMagnitude);
                if(fields.minWeightMagnitude > config.maxMwM || fields.minWeightMagnitude < 1){
                    res.status(400);
                    res.send({error: "MwM of " + fields.minWeightMagnitude + " is invalid or over max of " + config.maxMwM,"duration":(Date.now()-starttime)});
                } else if(!fields.trunkTransaction.match(/^[A-Z9]{81}$/)){
                    res.status(400);
                    res.send({error: "Invalid trunk transaction","duration":(Date.now()-starttime)});
                } else if(!fields.branchTransaction.match(/^[A-Z9]{81}$/)){
                    res.status(400);
                    res.send({error: "Invalid branch transaction","duration":(Date.now()-starttime)});
                } else if(!checkTrytes(fields.trytes)){
                    res.status(400);
                    res.send({error: "Invalid trytes provided","duration":(Date.now()-starttime)});
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
                    workers[target].handle.send({fields:fields,job:curjob,worker:target,starttime:starttime});                     
                }
            }
        } else if(req.body.command=="getNeighbors"){
            res.send({neighbors: [],"duration":(Date.now()-starttime)})
        } else if(req.body.command=="powInfo"){
            res.send({total: counters.totalrequests,failed: counters.failedrequests, averagetime: counters.averagetime + 'ms',"duration":(Date.now()-starttime)})
        } else {
            res.status(400);
            res.send({error: "Unknown command!","duration":(Date.now()-starttime)});
        }
    });
    http.createServer(server)
    .on('connection', function(socket) {
        socket.setTimeout(60000);
    })
    .listen(config.port, config.ip, () => {
        console.log(getPrintableTime()+" - Bound to "+config.ip+" and listening on and port "+config.port);
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
            process.send({task:"pow",job:message.job,worker:message.worker,success:false,starttime:message.starttime,result:result,id: process.pid});
        } else {
            process.send({task:"pow",job:message.job,worker:message.worker,success:true, starttime:message.starttime,trytes:result.trytes, duration:(Date.now() - startTime),id: process.pid});
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
