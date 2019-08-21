var express = require('express');
var router = express.Router();
var User = require('../models/user');
var path = require('path');

// GET route for reading data
router.get('/', function (req, res, next) {
  return res.sendFile(path.join(__dirname + '/wm.html'));
});

//POST route for updating data
router.post('/', function (req, res, next) {
  // confirm that user typed same password twice
  if (req.body.password !== req.body.passwordConf) {
    var err = new Error('Passwords do not match.');
    err.status = 400;
    res.send("passwords dont match");
    return next(err);
  }

  if (req.body.username &&
    req.body.password &&
    req.body.passwordConf) {

    var userData = {
      username: req.body.username,
      password: req.body.password,
	  points: 10000,
	  allpoints: 10000,
	  pointhistory: {0: 10000},
	  tipps: new Map(),
    }
    User.create(userData, function (error, user) {
      if (error) {
        return next(error);
      } else {
        req.session.userId = user._id;
        return res.redirect('/tipp');
      }
    });

  } else if (req.body.logusername && req.body.logpassword) {
    User.authenticate(req.body.logusername, req.body.logpassword, function (error, user) {
      if (error || !user) {
        var err = new Error('Wrong username or password.');
        err.status = 401;
        return next(err);
      } else {
        req.session.userId = user._id;
        return res.redirect('/tipp');
      }
    });
  } else {
    var err = new Error('All fields required.');
    err.status = 400;
    return next(err);
  }
})

// GET route after registering
router.get('/tipp', function (req, res, next) {
  User.findById(req.session.userId)
    .exec(function (error, user) {
      if (error) {
        return next(error);
      } else {
        if (user === null) {
          var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
        } else {
			 console.log(user.username + " logged in");
			 res.sendFile(path.join(__dirname + '/tipp.html'));
			 res.cookie('data', JSON.stringify(user));
        }
      }
    });
});

// GET for logout logout
router.get('/logout', function (req, res, next) {
  if (req.session) {
    // delete session object
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        return res.redirect('/');
      }
    });
  }
});

router.post('/save', (req, res) => {
	var actWeek = req.body.actWeek;
	console.log(actWeek);
	var oldUsername = req.body.myID;
	var value = req.body.chips;
	var choice = req.body.checkedValue;
	var gameID = req.body.gameID;
	var diffToOld = req.body.diffToOld;
	
	console.log(oldUsername + ", " + value + ", " + choice + ", " + gameID);
	
	User.findOne({username: oldUsername}, function (err, user) {
		user.points = (parseInt(user.points) - parseInt(diffToOld));
		var allTipps = user.tipps;
		var tipps = allTipps.get(actWeek);
		if(tipps == undefined) tipps = {};
		tipps[gameID] = {"value": +value, "choice": +choice};
		user.tipps.set(actWeek, tipps);
		console.log(tipps);
		
		user.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
});

router.post('/saveall', (req, res) => {
	var actWeek = req.body.actWeek;
	console.log(actWeek);
	var data = JSON.parse(req.body.array);
	console.log("id: " + data[0].myID);
	
	var oldUsername = data[0].myID;
	//sum diffToOld
	var diffToOld = 0;
	for(var i=0; i<data.length; i++) {
		diffToOld += parseInt(data[i].diffToOld);
	}
	console.log("diff: " + diffToOld);
	
	User.findOne({username: oldUsername}, function (err, user) {
		user.points = (parseInt(user.points) - parseInt(diffToOld));
		var allTipps = user.tipps;
		var tipps = allTipps.get(actWeek);
		if(tipps == undefined) tipps = {};
		for(var i=0; i<data.length; i++) {
			tipps[data[i].gameID] = {"value": +data[i].chips, "choice": +data[i].checkedValue};
		}
		user.tipps.set(actWeek, tipps);
		console.log(tipps);

		user.save(function (err) {
			if(err) {
				console.error('ERROR!');
			}
		});
	});
	res.end();
});

module.exports = router;