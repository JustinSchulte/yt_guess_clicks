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
		console.log("yyeed");
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
			 console.log(user.username);
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

router.post('/clicked', (req, res) => {
	var oldUsername = req.body.myID;
	var value = req.body.chips;
	var choice = req.body.checkedValue;
	var gameID = req.body.gameID;
	var diffToOld = req.body.diffToOld;
	var tipps = new Map();
	
	console.log(oldUsername + ", " + value + ", " + choice + ", " + gameID);
	User.findOne({username: oldUsername}, function (err, user) {
		user.points = (parseInt(user.points) - parseInt(diffToOld)),
		user.password = user.passwordConf,
		tipps = user.tipps,
		tipps.set(gameID, {"value": +value, "choice": +choice}),
		console.log(tipps);
		

		user.save(function (err) {
			console.log(user.password);
			if(err) {
				console.error('ERROR!');
			}
		});
	});
});


module.exports = router;