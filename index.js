//IP AND PORT
var ip = "localhost";
var portt = "3000";

//API KEYS
var apiKey_random = "YT2OVDgMTOtT8ExjmHxe7nfEyEbBlyKUIioN11igqaa7IpzNLCrykernyT43";
var apiKey_google = "AIzaSyAGgtcwTX7vyMrkLMBp7dmevMmIy_XBdS0";


var app = require('express')();
var http = require('http');
var http_server = require('http').Server(app);
var io = require('socket.io')(http_server);
var port = process.env.PORT || portt;

var express = require('express');
var path = require('path');

//NEW AUTH
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var User = require('./public/models/user');

//GAME-SCHEMA
var gameSchema = mongoose.Schema({
  id: String,
  state: String,
  quoteHome: Number,
  quoteAway: Number,
  quoteDraw: Number,
  winner: String,
  regular: Boolean
});
var game = mongoose.model('game', gameSchema);


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
var afk_symbol = " <span style=\"color:#A28823;font-size:30px;\">&#9992;</span>";;

var wm_afk = new WeakMap();
var skipCount = 0;

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});
app.get('/ytclicks', function(req, res){
	res.sendFile(__dirname + '/ytclicks.html');
});
app.get('/ytclicks/mobile',function(req,res){
	res.sendFile(path.join(__dirname +'/ytclicks/mobile.html'));
});
app.get('/montagsmaler', function(req, res){
	res.sendFile(__dirname + '/montagsmaler.html');
});
app.get('/memes', function(req, res){
	res.sendFile(__dirname + '/memes.html');
});
app.get('/memes', function(req, res){
	res.sendFile(__dirname + '/memes.html');
});
app.get('/wm', function(req, res){
	res.sendFile(__dirname + '/wm.html');
});
app.get('/autochess', function(req, res){
	res.sendFile(__dirname + '/autochess.html');
});

app.use(express.static(path.join(__dirname, 'public')));
var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/images/teewurst_icon.ico'));

//NEW
//connect to MongoDB
var uri = 'mongodb://schokokroko:toastbrot5@cluster0-shard-00-00-cibks.mongodb.net:27017,cluster0-shard-00-01-cibks.mongodb.net:27017,cluster0-shard-00-02-cibks.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true';
mongoose.connect(uri + "/wm_game");
var db = mongoose.connection;
//handle mongo error
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
	console.log("connected");
  // we're connected!
});
//use sessions for tracking logins
app.use(session({
  secret: 'work hard',
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: db
  })
}));
// parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// include routes
var routes = require('./public/routes/router');
app.use('/', routes);

//get refreshed through every 2min API call
var gameArray; 
var userArray;
app.get('/clicks', (req, res) => {
	result = {"games":gameArray, "users":userArray};
	res.send(result);
});



//AT START
//getFrequentSoccerStats(); //GET Soccer wm games
getFrequentNFLStats();

io.on('connection', function(socket){
	//INIT IF CONNECTED
	//socket.emit('setIPPORT', ip, portt); //NOT NECESSARY?!?!
	console.log("testConnect");
	
	//memes
	socket.on('memes', function(){
		const fs = require('fs');
		const dir = __dirname + '/public/memes';
		var count = 0;

		fs.readdir(dir, (err, files) => {
			count = files.length;
			console.log(files);
			socket.emit('memesCount', files);
		});
	});
	
	socket.on('gameConnection', function(){
		wm_points.set(socket, 0);
		wm_afk.set(socket, false);
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
		skipCount = 0;
		
		//getStartingPlayerCount
		startingConntectedPlayers = 0;
		for (var i in io.sockets.connected) {
			s = io.sockets.connected[i];
			if(!(wm_points.has(s))) continue; //localhost überspringe
			if(wm_afk.get(s)) continue; //afk-player nicht mitzählen
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
		var random_api_url = "http://randomyoutube.net/api/getvid?api_token=" + apiKey_random;
		console.log(random_api_url);
		request(random_api_url, function (error, response, body) {
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
				var google_api_url = "https://www.googleapis.com/youtube/v3/videos?id=" + vid + "%20&part=snippet%2CcontentDetails%2Cstatistics%20&key=" + apiKey_google;
				console.log(google_api_url);
				request(google_api_url, function (error, response, body) {
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
		if(wm_afk.get(socket)) {
			wm_startingPlayer.set(socket,1);
			startingConntectedPlayers++;
			wm_afk.set(socket,false);
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
				if(gameOver == 0) {
					showResults();
				}				
			}
		}
		refreshPlayerlist();
	});
	
	socket.on('skip', function() {
		skipCount++;
		io.emit('chat message', wm_names.get(socket) + " voted to skip (" + skipCount + "/" + startingConntectedPlayers + ").");
		
		if(skipCount > (startingConntectedPlayers/2)) {
			//setze alle, die nicht gevoted haben auf den AFK status
			for (var i in io.sockets.connected) {
				s = io.sockets.connected[i];
				if(!(wm_points.has(s))) continue; //überspringe Host
				if(wm_startingPlayer.has(s)) {
					if(!(wm.has(s))) {
						wm_afk.set(s, true);
					}
				}
			}
			showResults();
		}
	});
	
});

http_server.listen(port, function(){
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
			if(wm_afk.get(s)) {
				symbol = afk_symbol;
			} else if(wm.has(s)) {
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

function getFrequentSoccerStats() {
	setTimeout(wm_games, 1000*5);
	setInterval(wm_games, 1000*120);
}

function getFrequentNFLStats() {
	console.log("get nfl stats soon");
	//setTimeout(nfl_games, 1000*5); //TODO ?!?!!?
	//setInterval(nfl_games, 1000*120);
}

function nfl_games() {
	var wikiData;

    /*var options = {
        hostname: 'api.hooksdata.io',
        path: '/v1/fetch',
		header: 'content-type: application/json',
		data: '{"query": "SELECT * FROM SoccerGames"}',
		method: 'POST'
    };*/
	//var url_request = "http://api.hooksdata.io/v1/fetch?query=SELECT%20%2A%20FROM%20NFLGames%20"
	
	/*const httpTransport = require('https');
	const btoh = require('btoa');
    const responseEncoding = 'utf8';
    const httpOptions = {
        hostname: 'api.mysportsfeeds.com',
        port: '443',
        path: '/v2.0/pull/nfl/2018-2019/games.json',
        method: 'GET',
        headers: {"Authorization":"Basic " + Buffer.from('c7f39a66-dcac-45cc-9bad-a3b502' + ":" + 'MYSPORTSFEEDS').toString('base64')}
    };
	httpOptions.headers['User-Agent'] = 'node ' + process.version;*/
	
	var MySportsFeeds = require("mysportsfeeds-node");
	var msf = new MySportsFeeds("2.0", true);
	msf.authenticate("c7f39a66-dcac-45cc-9bad-a3b502", "MYSPORTSFEEDS");
	var data = msf.getData('nfl', 'current', 'seasonal_games', 'json', {});
	console.log(data);

	/*console.log("get nfl stats NOW!")
    var req = httpTransport.request(httpOptions, function(res) {

        if (!res) { 
            wikiData = "An error occured!";
        };

        var body = '';
        console.log("statusCode: ", res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function(data) {
            body += data;
        });

        res.on('end', function() {
			try {
				wikiData = JSON.parse(body);
			} catch(err) {
				console.log(body);
				return console.log("PARSING ERROR: \n" + err);
			}
            
			if(wikiData == undefined) {
				return console.log("wikiData is undefined");
			}
			//IF EVERYTHING WORKS OUT
			console.log(wikiData.items[0]);
        });
    });

    req.end();
    req.on('error', function (err) {
        wikiData = "API down?!?!";
    })*/
}

function wm_games() {
	var wikiData;

    var options = {
        hostname: 'api.football-data.org',
        path: '/v2/competitions/2000/matches', //2000 = WM
		headers: { 'X-Auth-Token': '07042891263a4116b3c3911ed00165f8' }
    };

    var req = http.request(options, function(res) {

        if (!res) { 
            wikiData = "An error occured!";
        };

        var body = '';
        console.log("statusCode: ", res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function(data) {
            body += data;
        });

        res.on('end', function() {
			try {
				wikiData = JSON.parse(body);
			} catch(err) {
				return console.log("PARSING ERROR: \n" + err);
			}
            
			if(wikiData == undefined) {
				return console.log("wikiData is undefined");
			}
			var matches = wikiData.matches;
			if(matches == undefined) {
				return console.log("matches is undefined");
			}
		
			db.collection('games').find().toArray((err, games) => {
				if (err) return console.log(err);
				gameArray = games;
				
				db.collection('users').find().toArray((err, users) => {
					if (err) return console.log(err);
					//create userArray without passwords
					userArray = new Array();
					for(var i=0; i<users.length; i++) {
						var person = {username:users[i].username, points:users[i].points, tipps:users[i].tipps};
						userArray.push(person);
					}
					
					
					for(var i=0; i<matches.length; i++) {
						var status = matches[i].status;
						if(status == "FINISHED") {
							var gameID = matches[i].homeTeam.name + "_" + matches[i].awayTeam.name;
							for(var j=0; j<games.length; j++) {
								if(games[j].id == gameID) {
									if(games[j].state == "SCHEDULED" || games[j].state == "IN_PLAY") {
										//scheduled changed to finished -> refresh and update points
										//update games db
										var regular = (matches[i].score.duration == "REGULAR");
										updateFinishedGame(gameID, matches[i].score.winner, regular);
										
										//iterate users
										for(var k=0; k<users.length; k++) {
											if(users[k].tipps[gameID] != undefined) {
												console.log("uh yeah theres a vote");
												var reward = users[k].tipps[gameID].value;
												console.log("reward_before:" + reward);
												var vote = users[k].tipps[gameID].choice;
												var quote = 0;
												console.log("vote: " + vote);
												console.log("winner: " + matches[i].score.winner);
												if(vote == 0 && matches[i].score.winner == "HOME_TEAM") {
													quote = games[j].quoteHome;
												} else if(vote == 1 && (matches[i].score.winner == "DRAW" || matches[i].score.duration != "REGULAR")) {
													quote = games[j].quoteDraw;
												} else if(vote == 2 && matches[i].score.winner == "AWAY_TEAM") {
													quote = games[j].quoteAway;
													console.log("reward_after:" + reward);
												}
												reward = reward * quote;
												reward = Math.ceil(reward)
												console.log("reward_now:" + reward);
												
												//update users db
												changeUserPoints(users[k].username, reward);
											}
										}
									}
								}
							}
						} else if(status == "IN_PLAY") {
							var gameID = matches[i].homeTeam.name + "_" + matches[i].awayTeam.name;
							for(var j=0; j<games.length; j++) {
								if(games[j].id == gameID) {
									if(games[j].state == "SCHEDULED") {
										//scheduled changed to IN_PLAY -> refresh db games
										game.findOne({id: games[j].id}, function (err, match) {
											match.state = "IN_PLAY";
											match.save(function (err) {
												if(err) {
													console.error('ERROR!');
												}
											});
										});
									}
								}
							}
						}
					}
				});
			});
        });
    });

    req.end();
    req.on('error', function (err) {
        wikiData = "API down?!?!";
    })

	
}

function changeUserPoints(name, reward) {
	User.findOne({username: name}, function (err, user) {
		console.log("points_before:" + user.points);
		user.points = parseInt(user.points) + reward,
		user.password = user.passwordConf,
		console.log("points_now:" + user.points);
		user.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
}

function updateFinishedGame(game_id, winner, regular) {
	game.findOne({id: game_id}, function (err, match) {
		match.state = "FINISHED";
		match.winner = winner;
		match.regular = regular;
		match.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
}
