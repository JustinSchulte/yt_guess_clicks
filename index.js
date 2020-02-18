//IP AND PORT
var ip = "localhost";
var portt = "3000";

//API KEYS
var apiKey_random = "";
var apiKey_google = "";
var apiKey_nfl = "";
var apiKey_odds = "";

//FOR RANDOM YOUTUBE
var youtube = require('youtube-random-video');

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

//ODDS API
var axios = require('axios');

//GAME-SCHEMA
var gameSchema = mongoose.Schema({
	id: String,
	week: Number,
	state: String,
	home: String,
	away: String,
	quoteHome: Number,
	quoteAway: Number,
	winner: String
});
var game = mongoose.model('game', gameSchema);

//NFL Matching
var actWeek;
var nflTeam_Map = {
	"Chicago Bears": "CHI",
	"Green Bay Packers": "GB",
	"Buffalo Bills": "BUF",
	"New York Jets": "NYJ",
	"Philadelphia Eagles": "PHI",
	"Washington Redskins": "WAS",
	"Baltimore Ravens": "BAL",
	"Miami Dolphins": "MIA",
	"Cleveland Browns": "CLE",
	"Tennessee Titans": "TEN",
	"Carolina Panthers": "CAR",
	"Los Angeles Rams": "LAR",
	"Jacksonville Jaguars": "JAX",
	"Kansas City Chiefs": "KC",
	"Atlanta Falcons": "ATL",
	"Minnesota Vikings": "MIN",
	"Cincinnati Bengals": "CIN",
	"Seattle Seahawks": "SEA",
	"Indianapolis Colts": "IND",
	"Los Angeles Chargers": "LAC",
	"Dallas Cowboys": "DAL",
	"New York Giants": "NYG",
	"San Francisco 49ers": "SF",
	"Tampa Bay Buccaneers": "TB",
	"Arizona Cardinals": "ARI",
	"Detroit Lions": "DET",
	"New England Patriots": "NE",
	"Pittsburgh Steelers": "PIT",
	"Houston Texans": "HOU",
	"New Orleans Saints": "NO",
	"Denver Broncos": "DEN",
	"Oakland Raiders": "OAK"
};

//yt clicks stuff
var wm = new WeakMap();
var wm_names = new WeakMap();
var wm_points = new WeakMap();
var video_clicks = -1;
var gameOver = 1; //Zu Beginn ist die 0.te Runde vorbei
var multipl = 1;
var additor = 0;

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
app.get('/nfl', function(req, res){
	res.sendFile(__dirname + '/nfl.html');
});
app.get('/autochess', function(req, res){
	res.sendFile(__dirname + '/autochess.html');
});
app.get('/terRulez', function(req, res){
	res.sendFile(__dirname + '/terRulez.html');
});

app.use(express.static(path.join(__dirname, 'public')));
var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/images/white512.png'));


//connect to MongoDB
var uri = 'mongodb://schokokroko:toastbrot5@cluster0-shard-00-00-cibks.mongodb.net:27017,cluster0-shard-00-01-cibks.mongodb.net:27017,cluster0-shard-00-02-cibks.mongodb.net:27017/nfl2019?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true&w=majority';
mongoose.connect(uri);
var db = mongoose.connection;
//handle mongo error
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
	console.log("connected");
	//get API Keys
	db.collection('apiKeys').find().toArray((err, keys) => {
		if (err) return console.log(err);
		for(var i=0; i<keys.length; i++) {
			switch(keys[i].id) {
				case "randomYT": apiKey_random = keys[i].key; break;
				case "google": apiKey_google = keys[i].key; break;
				case "nfl": apiKey_nfl = keys[i].key; break;
				case "odds": apiKey_odds = keys[i].key; break;
			}
		}
	});
	
	//AT START
	getFrequentNFLStats();
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
//for nfl_betting -> for table
var gameArray; 
var userArray;
app.get('/clicks', (req, res) => {
	result = {"games":gameArray, "users":userArray};
	console.log("send back: " + gameArray);
	res.send(result);
});

app.post('/saveAll', (req, res) => {
	var newTippsArray = req.body.data;
console.log(newTippsArray[0].myID);});

//YT GAME START
io.on('connection', function(socket){
	//INIT IF CONNECTED
	console.log("someone connected!");
	
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
				additor = 0;
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
		youtube.getRandomVid(apiKey_google, function(err , data){
			if (!err) {
				var importedJSON = data;
				if(importedJSON == undefined) {
					return console.log("GET random_api: importedJSON is undefined");
				}
				
				vid = importedJSON.id.videoId;
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
						var importedJSON;
						try {
							importedJSON = JSON.parse(body);
						} catch(err) {
							return console.log("GET google_api: PARSING ERROR: \n" + err);
						}
						if(importedJSON == undefined) {
							return console.log("GET google_api: importedJSON is undefined");
						}
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
						//VIDEO AVAILABLE 
						if(!(typeof JSON.stringify(importedJSON.items[0]["snippet"]["defaultAudioLanguage"]) === "undefined")) { //check if german
							var lang = importedJSON.items[0]["snippet"]["defaultAudioLanguage"];
							console.log("languageAudio: " + lang);
							if(lang.includes("de")) {
								additor = additor+2; //ADDITOR
								io.emit('chat message', "BONUS! GERMAN! +2");
							} else if(!(typeof JSON.stringify(importedJSON.items[0]["snippet"]["defaultLanguage"]) === "undefined")) {
								lang = importedJSON.items[0]["snippet"]["defaultLanguage"]
								console.log("language: " + lang);
								if(lang.includes("de")) {
									additor = additor+2; //ADDITOR
									io.emit('chat message', "BONUS! GERMAN! +2");
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
				console.log("error getting random video");
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
			additor = 0;
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
	addPoints = (addPoints + additor) * multipl;
	multipl = 1; //nur für diese Runde
	additor = 0;
	
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
//YT GAME END


//NFL START
function getFrequentNFLStats() {
	console.log("get nfl stats soon");
	refreshUserDB(); //once at start
	
	setTimeout(nfl_actMatchday, 1000*1);
	setTimeout(nfl_games, 1000*60); //after 1min
	setInterval(nfl_games, 1000*60*30); //each 30minutes
	setInterval(refreshUserDB, 1000*60*5); //each 5minutes
}

function scheduleWeekChange() {
	//just refresh every new day at ~1am
	var date = new Date();
	var afterMidnight = date.getHours()-7; //-6 because EST, -1 to be safe
	var timeoutValue = -1;
	if(afterMidnight < 0) {
		timeoutValue = -afterMidnight;
	} else {
		timeoutValue = 24-afterMidnight;
	}
	setTimeout(nfl_actMatchday, 1000*60*60*timeoutValue);
}

function refreshUserDB() {
	//add users from db
	db.collection('users').find().toArray((err, users) => {
		if (err) return console.log(err);
		userArray = users;
	});
}

function refreshGamesDB() {
	//add games of new week from db
	db.collection('games').find({week:actWeek}).toArray((err, games) => {
		if (err) return console.log(err);
		console.log("readDB week: " + actWeek);
		console.log("readDB games: " + games);
		gameArray = games;
	});
}

function nfl_actMatchday() {
	console.log("GET ACTUAL NFL WEEK");
	
	var wikiData; //JSON Data result
    var options = {
        hostname: 'api.sportsdata.io',
        path: '/v3/nfl/scores/json/CurrentWeek', //TODO should we use CurrentWeek or UpcomingWeek
		headers: {'Ocp-Apim-Subscription-Key': '5ddf733575c841fb85dae917a4b5fdd3'},
		method: 'GET'
    };
	var req = http.request(options, function(res) {
        if (!res) { 
            return console.log("GET ACTUAL NFL WEEK: An error occured!");
        };
		var body = '';
        console.log("GET ACTUAL NFL WEEK: statusCode: ", res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function(data) {
            body += data;
        });

        res.on('end', function() {
			try {
				wikiData = JSON.parse(body);
			} catch(err) {
				return console.log("GET ACTUAL NFL WEEK: PARSING ERROR: \n" + err);
			}
			if(wikiData == undefined) {
				return console.log("GET ACTUAL NFL WEEK: wikiData is undefined");
			}
			
			//YEAH, WE GOT SOME WIKIDATA, NOW IT BEGINS
			var newWeek = wikiData;
			
			var month = new Date().getMonth();
			var day = new Date().getDate();
			if(month == 7 || (month == 8 && day<5)) { //till 5.9.
				newWeek = 1; //TODO delete
				console.log("set week-variable to 1, while its pre-season");
			}
			actWeek = newWeek+17; //TODO playoff shit
            if(actWeek != 21) { //TODO pro bowl extra shit
                actWeek = 21;
            }
			refreshGamesDB(); //once at start (need actWeek)
			
			db.collection('actWeek').find().toArray((err, data) => {
				if (err) return console.log(err);
				if(data[0].week == actWeek) {
					return console.log("Week is still up to date, nothing todo!")
				}
				//NEW WEEK, change db and look up bets
				console.log("Week changed!")
				db.collection('actWeek').updateOne( //save actWeek to db
					{ id: 'act_week' },
					{ $set: { 'week': actWeek } }
				);
				
				//distribute all points for this week (includes income and pointHistory)
				distributePoints();

				//get games for new week
				getNewGames();
			});
			scheduleWeekChange(); //prepare next actWeek-Function call
			//END
		});
	});
	
	req.end();
    req.on('error', function (err) {
        console.log("GET ACTUAL NFL WEEK: " + err)
		setTimeout(nfl_actMatchday, 1000*60*30);
    });
}

function getNewOdds() {
	console.log("GET NEW ODDS");
	
	axios.get('https://api.the-odds-api.com/v3/odds', {
		params: {
			api_key: 'd9d91acf0d74f53f5f71669cde4ff17c',
			sport: 'americanfootball_nfl',
			region: 'us', // uk | us | au
			mkt: 'h2h' // h2h | spreads | totals
		}
	}).then(response => {
		// Events are ordered by start time (live events are first)
		console.log('Successfully got odds')
		var wikiData = JSON.parse(JSON.stringify(response.data));
		if(wikiData.success != true) {
			return console.log("ODDS JSON Parsing failed!")
		}
		
		//YEAH, WE GOT SOME WIKIDATA, NOW IT BEGINS
		
		//add odds to db
		for(var i=0; i<wikiData.data.length; i++) {
			var gameOdd = wikiData.data[i];
			if(gameOdd.sites_count > 0) {
				var homeTeam = gameOdd.home_team;
				var awayTeam;
				var homeId;
				if(gameOdd.teams[0] == homeTeam) { //homeTeam is not always first element of array!!!!
					homeId = 0;
					awayTeam = gameOdd.teams[1];
				} else {
					homeId = 1;
					awayTeam = gameOdd.teams[0];
				}
				var stringId = nflTeam_Map[homeTeam] + "_" + nflTeam_Map[awayTeam];
				db.collection('games').updateOne( //save actWeek to db
					{ id: stringId },
					{ $set: { 'quoteHome': gameOdd.sites[0].odds.h2h[homeId], 'quoteAway': gameOdd.sites[0].odds.h2h[(1-homeId)], 'homeFullName': homeTeam, 'awayFullName': awayTeam} }
				);
			}
		}
		setTimeout(refreshGamesDB, 1000*60); //refresh Array after one minute
		//END
	})
	.catch(error => {
		console.log('Error status', error.response.status);
		console.log(error.response.data);
		setTimeout(getNewOdds, 1000*60*10); //try again in 10minutes
	})
}

function getNewGames() {
	console.log("GET NEW GAMES");
	var pathActWeek = '/v3/nfl/scores/json/ScoresByWeek/2019POST/' + (actWeek-17); //TODO POST because playoffs

	var wikiData; //JSON Data result
	var options = {
		hostname: 'api.sportsdata.io',
		path: pathActWeek,
		headers: {'Ocp-Apim-Subscription-Key': '5ddf733575c841fb85dae917a4b5fdd3'},
		method: 'GET'
	};
	var req = http.request(options, function(res) {
		if (!res) { 
			return console.log("GET NFL GAMES: An error occured!");
		};
		var body = '';
		console.log("GET NFL GAMES: statusCode: ", res.statusCode);
		res.setEncoding('utf8');

		res.on('data', function(data) {
			body += data;
		});

		res.on('end', function() {
			try {
				wikiData = JSON.parse(body);
			} catch(err) {
				return console.log("GET NFL GAMES: PARSING ERROR: \n" + err);
			}
			if(wikiData == undefined) {
				return console.log("GET NFL GAMES: wikiData is undefined");
			}
			
			//YEAH, WE GOT SOME WIKIDATA, NOW IT BEGINS
		
			for(var i=0; i<wikiData.length; i++) {
				var match = wikiData[i];
				var matchId = match.HomeTeam + "_" + match.AwayTeam;
				var gameData = {
					id: matchId,
					week: actWeek,
					state: "NotStarted",
					home: match.HomeTeam,
					away: match.AwayTeam,
					homeFullName : "",
					awayFullName : "",
					quoteHome: 0,
					quoteAway: 0,
					winner: "none"
				}
				game.create(gameData, function (error, g) {
					if(error) {
						return console.log(error);
					}
				});
			}
			setTimeout(getNewOdds, 1000*5);
			//END
		});
	});
	
	req.end();
	req.on('error', function (err) {
		console.log("GET NFL GAMES: " + err)
		setTimeout(getNewGames, 1000*60*10); //try again in 10minutes
	});
}

function distributePoints() {
	var lastWeek = actWeek-1;
	
	db.collection('users').find().toArray((err, users) => {
		if (err) return console.log(err);
		db.collection('games').find({week:lastWeek}).toArray((err, games) => {
			if (err) return console.log(err);		
			for(var i=0; i<users.length; i++) {
				var allreward = 0;
				if(users[i].tipps[lastWeek] != undefined) { //no votes this week from user[i]
					for(var j=0; j<games.length; j++) {
						var gameID = games[j].id;
						if(users[i].tipps[lastWeek][gameID] != undefined) {
							console.log("uh yeah, theres a vote");
							var stake = users[i].tipps[lastWeek][gameID].value;
							console.log("reward_before:" + stake);
							var vote = users[i].tipps[lastWeek][gameID].choice;
							var quote = 0;
							var winner = games[j].winner;
							console.log("vote: " + vote);
							console.log("winner: " + winner);
							if(vote == 0 && winner == "HOME_TEAM") {
								quote = games[j].quoteHome;
							} else if(vote == 1 && winner == "AWAY_TEAM") {
								quote = games[j].quoteAway;
								console.log("reward_after:" + stake);
							}
							var reward = stake * quote;
							reward = Math.ceil(reward)
							console.log("reward_now:" + reward);
							allreward += reward;	
						}
					}
				}
				//update users db
				updateUserPoints(users[i].username, allreward);
			}
		});
	});
}

function nfl_games() {
	var hour = new Date().getHours();
	if(hour < 16 && hour >= 6) {
		return; //only needed at game time -> fewer api calls
	}
	console.log("GET NFL GAMES");
	db.collection('actWeek').find().toArray((err, data) => {
		if (err) return console.log(err);
		var pathActWeek = '/v3/nfl/scores/json/ScoresByWeek/2019POST/' + (data[0].week-17); //TODO POST because playoffs and -17
	
		var wikiData; //JSON Data result
		var options = {
			hostname: 'api.sportsdata.io',
			path: pathActWeek,
			headers: {'Ocp-Apim-Subscription-Key': '5ddf733575c841fb85dae917a4b5fdd3'},
			method: 'GET'
		};
		var req = http.request(options, function(res) {
			if (!res) { 
				return console.log("GET NFL GAMES: An error occured!");
			};
			var body = '';
			console.log("GET NFL GAMES: statusCode: ", res.statusCode);
			res.setEncoding('utf8');

			res.on('data', function(data) {
				body += data;
			});

			res.on('end', function() {
				try {
					wikiData = JSON.parse(body);
				} catch(err) {
					return console.log("GET NFL GAMES: PARSING ERROR: \n" + err);
				}
				if(wikiData == undefined) {
					return console.log("GET NFL GAMES: wikiData is undefined");
				}
				
				//YEAH, WE GOT SOME WIKIDATA, NOW IT BEGINS
				console.log("compare nfl-data and user-tipps...");
				var matches = wikiData;
				
				db.collection('games').find({week:actWeek}).toArray((err, games) => {
					if (err) return console.log(err);			
					for(var i=0; i<matches.length; i++) {
						var gameID = matches[i].HomeTeam + "_" + matches[i].AwayTeam;
						if(matches[i].IsOver) { //is Game over?
							for(var j=0; j<games.length; j++) {
								if(games[j].id == gameID) {
									if(games[j].state == "NotStarted" || games[j].state == "InPlay") {
										//scheduled changed to finished -> refresh and update points
										//update games db
										var winner = "NONE";
										if(matches[i].HomeScore<matches[i].AwayScore) {
											winner = "AWAY_TEAM";
										} else if(matches[i].HomeScore>matches[i].AwayScore) {
											winner = "HOME_TEAM";
										}
										updateFinishedGame(gameID, winner);
									}
								}
							}
						} else if(matches[i].HasStarted) { //has game started?
							var gameID = matches[i].HomeTeam + "_" + matches[i].AwayTeam;
							console.log("HasStarted: " + gameID);
							for(var j=0; j<games.length; j++) {
								if(games[j].id == gameID) {
									if(games[j].state == "NotStarted") {
										//scheduled changed to IN_PLAY -> refresh db games
										game.findOne({id: games[j].id}, function (err, match) {
											match.state = "InPlay";
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
					setTimeout(refreshGamesDB, 1000*5);
				});
				//END
			});
		});
		
		req.end();
		req.on('error', function (err) {
			console.log("GET NFL GAMES: " + err)
		});
	});
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

function updateUserPoints(name, reward) {
	User.findOne({username: name}, function (err, user) {
		console.log("points_before:" + user.points);
		//add weekly income to points 
		//allpoints should be equal to points at this time
		user.points = parseInt(user.points) + reward + 2000;
		user.allpoints = parseInt(user.points);
		console.log("points_now:" + user.points);
		//save pointhistory for week
		var pointhistory = user.pointhistory;
		pointhistory.set((actWeek-1).toString(), user.points);
		user.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
}

function updateFinishedGame(game_id, winner, regular) {
	game.findOne({id: game_id}, function (err, match) {
		match.state = "IsOver";
		match.winner = winner;
		match.regular = regular;
		match.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
}

/*
function addPointHistory(name) {
	User.findOne({username: name}, function (err, user) {
		//add weekly income to points 
		//allpoints should be equal to points at this time
		user.points = parseInt(user.points) + 2000;
		user.allpoints = parseInt(user.allpoints) + 2000;
		//save pointhistory for week
		var pointhistory = user.pointhistory;
		pointhistory.set((actWeek-1).toString(), user.points);
		user.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
}

function changeUserPoints(name, reward, stake) {
	User.findOne({username: name}, function (err, user) {
		console.log("points_before:" + user.points);
		user.points = parseInt(user.points) + reward,
		user.allpoints = parseInt(user.allpoints) + reward - stake;
		console.log("points_now:" + user.points);
		user.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
}
*/