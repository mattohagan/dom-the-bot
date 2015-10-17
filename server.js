var express = require('express');
var app = express();
var dotenv = require('dotenv');

app.set('port', (process.env.PORT || 5000));

dotenv.load();

function authRequest(req, res, next){
	var acceptable_tokens = [
		process.env.SNAG-SLACK-TOKEN
	];

	// check if token is legit
	if(acceptable_tokens.indexOf(req.query.token) === -1){
		res.send(401);
	}

	next();
}

app.all('*', authRequest);

app.get('/slack/snag', function(req, res){
	console.log(req.query);
	console.log(req.body);

});


