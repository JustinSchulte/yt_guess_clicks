//IP AND PORT
var ip = "teewurst24.party";
var portt = "80";
//IP AND PORT


var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || portt;

var express = require('express');
var path = require('path');

var wm = new WeakMap();
var wm_names = new WeakMap();
var wm_points = new WeakMap();
var video_clicks = -1;
var gameOver = 1; //Zu Beginn ist die 0.te Runde vorbei
var multipl = 1;

var startingConntectedPlayers = 0;
var wm_startingPlayer = new WeakMap();

var wm_fish = new WeakMap();

var haken = " <span style=\"color:#0f0;font-size:30px;\">&check;</span>";
var kreuz = " <span style=\"color:#f00;font-size:30px;\">&cross;</span>";

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});
app.get('/ytclicks', function(req, res){
	res.sendFile(__dirname + '/ytclicks.html');
});
app.get('/ytclicks/mobile',function(req,res){
	res.sendFile(path.join(__dirname +'/ytclicks/mobile.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/images/teewurst_icon.ico'));

io.on('connection', function(socket){
	//INIT IF CONNECTED
	socket.emit('setIPPORT', ip, portt);
	socket.on('gameConnection', function(){
		wm_points.set(socket, 0);
		io.emit('chat message', "A new player has connected.");
		refreshPlayerlist();
		if(gameOver == 0) { //Spiel läuft
			socket.emit('deactNextB'); //nextButton für den neuen Spieler deaktivieren
		}
	});
	
	//ALL FUNCTIONS
	socket.on('startLocal', function(){
		//falls Spieler momentan tippen muss
		if(gameOver ==0 && wm_startingPlayer.has(socket)) {
			startingConntectedPlayers--;
			if(startingConntectedPlayers == 0) {
				gameOver = 1;
				io.emit('actNextB'); //ak nextButton
				multipl = 1;
			}
		}
		//lösche Spieler aus allen Listen
		wm.delete(socket);
		wm_names.delete(socket);
		wm_points.delete(socket);
		wm_startingPlayer.delete(socket);
		wm_fish.delete(socket);
		refreshPlayerlist();
	});
	socket.on('stopLocal', function(){
		//füge Host wieder hinzu
		wm_points.set(socket, 0);
		refreshPlayerlist();
		if(gameOver == 0) { //Spiel läuft
			socket.emit('deactNextB'); //nextButton für den "neuen" Spieler deaktivieren
		}
	});
	socket.on('change name', function(name){
		var oldName = wm_names.get(socket)
		wm_names.set(socket, name);
		io.emit('chat message', "\"" + oldName + "\" changed his name to \"" + name + "\".");
		refreshPlayerlist();
		//console.log(name)
	});
	socket.on('fish', function(){
		io.emit('chat message', wm_names.get(socket) + " used the FISHCARD!");
		wm_fish.set(socket, 1); //vermerken wer fish setzt
	});
	
	socket.on('nextVideo', function(){
		if(gameOver == 0) return; //nextVideo nur möglich wenn Runde vorbei
		gameOver = 0;
		io.emit('deactNextB'); //deak nextButton
		console.log("nextVideo");
		
		//getStartingPlayerCount
		startingConntectedPlayers = 0;
		for (var i in io.sockets.connected) {
			s = io.sockets.connected[i];
			if(!(wm_points.has(s))) continue; //localhost überspringe
			startingConntectedPlayers++;
			wm_startingPlayer.set(s, 1); //vermerken wer mitspielt
		}
		
		//delete tipps
		for (var i in io.sockets.connected) {
			s = io.sockets.connected[i]; 
			wm.delete(s);
			wm_fish.delete(s);
		}
		refreshPlayerlist();
		
		//getRandomVID...
		var vid = "test";
		var request = require('request');
		request('http://randomyoutube.net/api/getvid?api_token=764SPKrj5Bm0oJIMqrii8tCj5rAycyHjGvW0J7dcNvTAlV1B7kpMjsqRitIA', function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var importedJSON = JSON.parse(body);
				vid = importedJSON.vid;
				if (typeof vid === "undefined") {
					console.log("undefined VID");
					io.emit('actNextB'); //ak nextButton
					gameOver = 1; //damit Button wieder gedrückt werden kann
					return;
				}
				console.log(vid);
				io.emit('nv', vid);
				
				//getClicks
				var y_api_url = "https://www.googleapis.com/youtube/v3/videos?id=" + vid + "%20&part=snippet%2CcontentDetails%2Cstatistics%20&key=AIzaSyAGgtcwTX7vyMrkLMBp7dmevMmIy_XBdS0";
				console.log(y_api_url);
				request(y_api_url, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						var importedJSON = JSON.parse(body);
						console.log(JSON.stringify(importedJSON));
						if (typeof JSON.stringify(importedJSON.items[0]) === "undefined") {
							console.log("undefined clicks");
							notAvailableVideo();
							return;
						}
						if(typeof JSON.stringify(importedJSON.items[0]["contentDetails"]["regionRestriction"]) === "undefined") {}
						else{
							//check if video is not visible in Germany
							console.log("regionRestriction exists");
							var x = importedJSON.items[0]["contentDetails"]["regionRestriction"];
							if(!(typeof JSON.stringify(x["allowed"]) === "undefined")) {
								console.log("allowed array exist")
								if(!contains(x["allowed"], "DE")) {
									console.log("DE not in allowed");
									notAvailableVideo();
									return;
								}
							}
							if(!(typeof JSON.stringify(x["blocked"]) === "undefined")) {
								console.log("blocked array exist")
								if(contains(x["blocked"], "DE")) {
									console.log("DE in blocked");
									notAvailableVideo();
									return;
								}	
							}
						}
						var clicks = JSON.stringify(importedJSON.items[0]["statistics"]["viewCount"]);
						clicks = clicks.substring(1, clicks.length-1); //delete ""
						console.log("clicks: " + clicks);
						video_clicks = clicks;
					}
					else {
						console.log("error?!?!?!");
					}
				});
			}
			else {
				console.log("error?!?!?!");
			}
		});
	});
	
	socket.on('chat message', function(msg){ //Nur zum Tippen der Clicks
		if(video_clicks == -1) return; //erstes Video
		if(gameOver == 1) return;
		if(!(wm_startingPlayer.has(socket))) return //neuer Spieler darf nicht voten
		wm.set(socket, msg);
		
		var tipps = 0
		for (var i in io.sockets.connected) {
			var s = io.sockets.connected[i];
			if(wm.has(s)) {
				console.log("value: " + wm.get(s))
				tipps++;
			}
		}
		console.log("startingConntectedPlayers: " + startingConntectedPlayers);
		console.log("tipps: " + tipps);
		refreshPlayerlist();
		
		if(startingConntectedPlayers == tipps) {
			//Game over, show results
			showResults();
		}
	});
	
	socket.on('disconnect', function() {
		io.emit('chat message', wm_names.get(socket) + " disconnected.");
		if(wm_startingPlayer.has(socket)) { //wenn dieser Player mitgespielt hat
			startingConntectedPlayers--; //need one less 
		}
		if(startingConntectedPlayers == 0) { //letzter aktiver Spieler verlässt
			gameOver = 1;
			io.emit('actNextB'); //ak nextButton
			multipl = 1;
		} else {
			var tipps = 0
			for (var i in io.sockets.connected) {
				var s = io.sockets.connected[i];
				if(wm.has(s)) {
					console.log("value: " + wm.get(s))
					tipps++;
				}
			}
			if(startingConntectedPlayers == tipps) {
				//Game over, show results
				showResults();
			}
		}
		refreshPlayerlist();
	});
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});

function showResults() {
	//Game over, show results
	gameOver = 1;
	io.emit('actNextB'); //ak nextButton
	io.emit('clickAmount', video_clicks);
	
	var win_s = []; //Liste von Gewinnern
	var diff = 9007199254740992;
	var voteList = "";
	for (var i in io.sockets.connected) { //player with lowest diff
		s = io.sockets.connected[i];
		if(!(wm_points.has(s))) continue; //überspringe Host
		console.log(video_clicks);
		if(Math.abs(wm.get(s) - video_clicks) < diff) {
			win_s = []; //array leeren, gibt nur einen Besten(Fall zwei zuvor haben sie selbe nicht minDiff-Wertung)
			win_s[0] = s;
			diff = Math.abs(wm.get(s) - video_clicks);
		} else if(Math.abs(wm.get(s) - video_clicks) == diff) {
			win_s.push(s);
		}
	}
	
	//add points
	var value = wm.get(win_s[0]);
	var addPoints = 0;
	if(value == video_clicks && video_clicks != 0) {
		addPoints = video_clicks;
	} else {
		addPoints = 1;
	}
	addPoints = addPoints * multipl;
	multipl = 1; //nur für diese Runde
	
	for (var i = 0; i < win_s.length; i++) {
		var p_addPoints = addPoints;
		var win = win_s[i];
		if(wm_fish.has(win)) p_addPoints = p_addPoints * 2; //fishcard aktiviert
		var newScore = parseInt(p_addPoints) + parseInt(wm_points.get(win));
		wm_points.set(win, newScore);
		
		//send winning message
		var name = wm_names.get(win);
		var message = name + " won with an estimation of " + wm.get(win_s[i]) + " clicks and get " + p_addPoints + " Points.";
		io.emit('chat message', message);
	}
		
	//show all scores and guesses
	var scoresText = "<tr><th></th><th>Guess</th><th>Score</th></tr>";
	for (var i in io.sockets.connected) { //player with lowest diff
		s = io.sockets.connected[i];
		if(!(wm_points.has(s))) continue; //überspringe Host
		var name = wm_names.get(s);
		var value = wm_points.get(s);
		var guess = wm.get(s);
		scoresText += "<tr><td>" + name + "</td><td>" + guess + "</td><td>" + value + "</td></tr>";
	}
	io.emit('score', scoresText);
}

function refreshPlayerlist() {
	var pl = "";
	for (var i in io.sockets.connected) {
		s = io.sockets.connected[i];
		if(!(wm_points.has(s))) continue; //überspringe Host
		var symbol = "";
		if(wm_startingPlayer.has(s)) {
			if(wm.has(s)) {
				symbol = haken;
			} else {
				symbol = kreuz;
			}
		}
		pl = pl + "<li>" + wm_names.get(s) + symbol + "</li>";
	}
	io.emit('playerlist', pl);
}

function contains(arr, element) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === element) {
            return true;
        }
    }
    return false;
}

function notAvailableVideo() {
	gameOver = 1;
	multipl = multipl*2; //MULTIPLIKATOR
	io.emit('chat message', "MULTIPLIER!");
	io.emit('actNextB'); //ak nextButton
	return;
}
