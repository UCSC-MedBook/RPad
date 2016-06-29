var express = require('express');
var app = express();
var Cookies = require("cookies");
var http = require("http");
var Docker = require("dockerode");
var _ = require("underscore");
var bodyParser = require('body-parser')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
//app.use(bodyParser.json())



var docker = new Docker({
  socketPath: "/var/run/docker.sock"
});

var httpProxy = require('http-proxy')
var proxy = httpProxy.createProxyServer({
  ignorePath: true
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {

  //hack the login request to work
  if (req.method === "POST" && req.url.endsWith("/auth-do-sign-in")){
    console.log("QUERY PARAMS", req.queryParams);
    console.log("PARAMS", req.params)
    console.log("BODY", req.body);

    console.log("PROXY REQ", proxyReq.body);
  }
});

/* Without this function, redirects will not include the necessary r-pad/id/:id prefix */

var patchResponse = function(req, res){
  //bail if status is not between 300 and 400
  res.oldWriteHead = res.writeHead;
  res.writeHead = function(statusCode, reason, obj){
    if (statusCode < 300 || statusCode >= 400){
      res.oldWriteHead(statusCode, reason, obj);
      return;
    }
    var oldLocation = res._headers.location;

    //just handle the absolute redirects from rstudio login
    if (oldLocation && oldLocation.startsWith("http")){ //
      var oldLocationPath = res._headers.location.split(/http:\/\/.*?\//)[1];
    } else {
      res.oldWriteHead(statusCode, reason, obj);
      return;
    }

    if (oldLocation && !oldLocation.startsWith("/r-pad") ){
      var newLocation = "/r-pad/id/" + req.params.id + "/" + oldLocationPath;
      console.log("new location", newLocation);
      res.setHeader("location", newLocation);
    }
    res.oldWriteHead(statusCode, reason, obj);
  };
}

/* given an RStudio container id determine its URL */
var findTarget = function(req, callback){
  var container = docker.getContainer(req.params.id);
  container.inspect(function(err, data){
    if (err){
      callback(err);
      return;
    } else {
      //TODO fix this
      //for some odd reason data.Name has a slash before it...
      //some strange docker decision (see https://github.com/docker/docker/issues/6705)
      var relativePath = req.path.split(/\/r-pad\/id\/[0-9a-f].*?\//)[1] || "";
      console.log("req path", req.path);
      console.log("relative path", relativePath);
      callback(null, "http:/" + data.Name + ":8787/" + relativePath);
    }
  })
};

//TODO consider using app.all

app.get("/r-pad/id/:id*", function(req, res){
  console.log("REQ URL", req.url);
  patchResponse(req, res);
  findTarget(req, function(err, target){
    console.log("TARGET", target);
    proxy.web(req, res, {target: target});
  });
});

app.post("/r-pad/id/:id*", function(req, res){
  patchResponse(req, res);
  findTarget(req, function(err, target){
    console.log(req.params);
    console.log(req.queryParams);
    proxy.web(req, res, {target: target});
  });
});

var createRStudioContainer = function(callback){
  docker.createContainer({
    Image: "rocker/rstudio", //TODO specify version here
    name: "rstudio-instance-" + Date.now(),
    ExposedPorts: {
      "8787/tcp": {}
    }
  }, callback);
};

// respond with "hello world" when a GET request is made to the homepage
app.get('/r-pad/create', function(req, res) {
//  patchResponse(req, res);
  console.log("creating rstudio container");
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
              console.log("ERR", err);
              console.log("RESULT", result);
              //TODO figure out cleaner way to wait for the server to be ready
              setTimeout(function(){
                res.redirect("/r-pad/id/" + container.id);
              }, 2000);
            });
          });
        });
      });
    }
  });
});


var port = 3000;
console.log("RPad listening on port", port);
app.listen(port);
