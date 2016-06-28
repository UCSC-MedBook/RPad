var express = require('express');
var app = express();
var Cookies = require("cookies");
var http = require("http");
var Docker = require("dockerode");
var _ = require("underscore");

var docker = new Docker({
  socketPath: "/var/run/docker.sock"
});

var httpProxy = require('http-proxy')
var proxy = httpProxy.createProxyServer({
  ignorePath: true
});

/* Without this function, redirects will not include the necessary r-pad/id/:id prefix */
var patchResponse = function(req, res){
  res.oldWriteHead = res.writeHead;
  res.writeHead = function(statusCode, reason, obj){
    var oldLocation = res._headers.location;
    if (oldLocation && !oldLocation.startsWith("/r-pad") ){
      var newLocation = "r-pad/id/" + req.params.id + oldLocation;
      console.log("new location", newLocation);
      res.setHeader("location", newLocation);
    }
    res.oldWriteHead(statusCode, reason, obj);
  };
}

/* given an RStudio container id determine its URL */
var findTarget = function(id, callback){
  var container = docker.getContainer(id);
  container.inspect(function(err, data){
    if (err){
      callback(err);
      return;
    } else {
      //TODO fix this
      callback(null, "http://localhost:8000/r" + data.Name + ":8787");
    }
  })
};

app.get("/r-pad/id/:id*", function(req, res){
  patchResponse(req, res);
  findTarget(req.params.id, function(err, target){
    var path = req.path;
    var dest = path.replace(/\/r-pad\/id\/[0-9a-f]*/, target);
    proxy.web(req, res, {target: dest});
  });
});

app.post("/r-pad/id/:id*", function(req, res){
  patchResponse(req, res);
  findTarget(req.params.id, function(err, target){
    var path = req.path;
    var dest = path.replace(/\/r-pad\/id\/[0-9a-f]*/, target);
    proxy.web(req, res, {target: dest});
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
