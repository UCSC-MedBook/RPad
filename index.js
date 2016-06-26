var express = require('express');
var app = express();
var Cookies = require("cookies");
var http = require("http");
var Docker = require("dockerode");

var docker = new Docker({socketPath: '/var/run/docker.sock'});
docker.listContainers(function (err, containers) {
  console.log("ERR", err);
  containers.forEach(function (containerInfo) {
    console.log(containerInfo);
  });
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
      if (data != null) all += data;
      console.log("DATA", all);
      callback(data);
    });
  });
  medbookUserReq.on("error", function(err) {
    console.log("ERRR", err);
  });
  medbookUserReq.end();
};

// respond with "hello world" when a GET request is made to the homepage
app.get('/r-pad', function(req, res) {
  var cookies = new Cookies(req, res);
  console.log("COOKIES", cookies);
//  console.log("GATEWAY TOKEN", cookies.get("gateway_token"));
  res.send('hello r pad');
  getUser(req, function(info){
    console.log("INFO", info);
  });
});


var port = 3000;
console.log("RPad listening on port", port);
app.listen(port);
