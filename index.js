var express = require('express');
var app = express();
var Cookies = require("cookies");
var http = require("http");
var Docker = require("dockerode");
var _ = require("underscore");
var bodyParser = require('body-parser')
var crypto = require("crypto");


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
//app.use(bodyParser.json())



var docker = new Docker({
  socketPath: "/var/run/docker.sock"
});

var getUser = function(req, callback){
  var options = {
    method: 'GET',
    host: "telescope",
    path: '/medbookUser',
    port: 3000,
    headers: { 'cookie': req.headers.cookie, },
    keepAlive: true,
    keepAliveMsecs: 3600000, // an hour
  };
  var medbookUserReq = http.request(options, function(medbookUserRes) {
    medbookUserRes.setEncoding('utf8');
    var all = "";
    medbookUserRes.on("data", function(data) { all += data; });
    medbookUserRes.on("end", function(data) {
      if (data != null) {all += data}
      console.log("ALL", all);
      if (!all || all === "none"){
        callback(null, null);
      } else {
        callback(null, null);
      }
    });
  });
  medbookUserReq.on("error", function(err) {
    callback(err);
  });
  medbookUserReq.end();
}

app.get("/r-pad/id/:id*", function(req, res){
  console.log("REQ URL", req.url);
  patchResponse(req, res);
  findTarget(req, function(err, target){
    console.log("TARGET", target);
    proxy.web(req, res, {target: target});
  });
});

var createRStudioContainer = function(callback){
  crypto.randomBytes(25, function(err, buffer) {
    var name = buffer.toString('hex');
    docker.createContainer({
      Image: "rocker/rstudio", //TODO specify version here
      name: "rstudio_" + name,
      ExposedPorts: {
        "8787/tcp": {}
      }
    }, callback);
  });
};

app.get('/r-pad/create', function(req, res) {
  console.log("createing rstudio container based on query params", req.query);
  getUser(req, function(err, user){
    if (user){
      console.log("user collaborations", user.collaborations);
    }
    createRStudioContainer(function(err, container){
      if (err){
        console.error(err);
        return;
      } else {
        container.start(function(err, data){
          container.inspect(function(err, data){
            docker.listNetworks(function(err, networks){
              var medbookDefaultNetwork = _.find(networks, function(network){
                return network.Name === "medbook_default";
              });
              medbookDefaultNetwork = docker.getNetwork(medbookDefaultNetwork.Id);
              medbookDefaultNetwork.connect({
                Container: data.Id
              }, function(err, result){
                if (err){
                  console.error("error connecting to medbook default network");
                }
                //TODO figure out cleaner way to wait for the server to be ready
                setTimeout(function(){
                  res.redirect(process.env.RPAD_SERVER + "/rstudio" + data.Name + "/");
                }, 2000);
              });
            });
          });
        });
      }
    })
  })
});


var port = 3000;
console.log("RPad listening on port", port);
app.listen(port);
