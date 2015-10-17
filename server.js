var express = require('express');
var app = express();
var dotenv = require('dotenv');
var Slack = require('slack-client');

app.set('port', (process.env.PORT || 5000));

dotenv.load();

var token = process.env.DOM_API_TOKEN;
var autoReconnect = true;
var autoMark = true;
slack = new Slack(token, autoReconnect, autoMark)

function authRequest(req, res, next){
	var acceptable_tokens = [
		process.env.SNAG_SLACK_TOKEN
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


app.listen(app.get('port'), function() {
    console.log('Server running at port ' + app.get('port').toString());
});



slack.on('open', function(){
	console.log('Connected to '+slack.team.name+' as '+slack.self.name);
});

slack.on('error', function(err){
	console.log('Error'+err);
});

slack.login();