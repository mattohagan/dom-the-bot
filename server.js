var express = require('express');
var app = express();
var dotenv = require('dotenv');
var Slack = require('slack-client');
var request = require('request');
var bodyParser = require('body-parser');

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

dotenv.load();

var reservationUrl = "http://domi-room.herokuapp.com/room";
var token = process.env.DOM_API_TOKEN;
var autoReconnect = true;
var autoMark = true;
slack = new Slack(token, autoReconnect, autoMark)

function authRequest(req, res, next){
	var acceptable_tokens = [
		process.env.SNAG_SLACK_TOKEN
	];

	console.log('body');
	console.log(req.body);
	console.log('query');
	console.log(req.query);

	// check if token is legit
	if(acceptable_tokens.indexOf(req.body.token) === -1){
		res.sendStatus(401);
	}

	next();
}

app.all('*', authRequest);

app.get('/slack/snag', function(req, res){
	console.log('yo slack/snag');
	console.log(req.query);
	console.log(req.body);

	res.send({hello:'world'});
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


function parseRequest(text){

	console.log(text);


	var data = {
		"email": email,
		"company": company,
		"room": room,
		"start": start,
		"end": end
	};

	return data;
}

function makeReservation(data){
	var options = {
		url: reservationUrl,
		method: 'POST',
		json: data
	}

	request.post(options, function(err, response, body){
		if(err)
			return err;

		console.log('response    '+response);

	});

}














