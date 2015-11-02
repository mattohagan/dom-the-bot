// the dom bot.
// this file should just consist of core level bot logic
// and pipelining what needs to be done based on user messages

var express = require('express');
var app = express();
var dotenv = require('dotenv');
var Slack = require('slack-client');
var bodyParser = require('body-parser');

// load in helper functions
app.helpers = require('./app/helpers.js')(app);
app.helpers.trim = require('trim');

// personal modules
var announce = require('./app/announce.js')(app);
var snag = require('./app/snag.js')(app);
var lost = require('./app/lost-and-found.js')(app);

app.set('port', (process.env.PORT || 5000));
// needed for parsing requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// load in tokens from .env
dotenv.load();

// set some variables
app.reservationUrl = process.env.RESERVATION_URL;
app.adminUsers = ['mattohagan', 'christineurban','lucaslindsey', 'sabrinatorres', 'peterpan'];
app.reservationQueue = {};
app.userStates = {};
app.lostAndFound = [];

// authorize our slack object
var slackToken = process.env.DOM_API_TOKEN;
var autoReconnect = true;
var autoMark = true;
app.slack = new Slack(slackToken, autoReconnect, autoMark);



// authorize incoming requests
function authRequest(req, res, next){
	var acceptable_tokens = [
		process.env.SNAG_SLACK_TOKEN
	];

	// check if token is legit
	if(acceptable_tokens.indexOf(req.body.token) === -1){
		// it's not legit
		res.sendStatus(401);
	}

	next();
}

// auth to make sure it's from slack
app.all('*', authRequest);

app.listen(app.get('port'), function() {
    console.log('Server running at port ' + app.get('port').toString());
});


app.slack.on('open', function(){
	console.log('Connected to '+app.slack.team.name+' as '+app.slack.self.name);
});

app.slack.on('error', function(err){
	console.log(err);
});

// start up bot
app.slack.login();

// whenever a message is received
app.slack.on('message', function(message){
	var channel = app.slack.getChannelGroupOrDMByID(message.channel);
	var text = message.text;
	var userId = message.user;

	// for error checking because I think this happens when the bot accidentally sends a second message as itself
	if(!userId)
		console.log(message);

	
	// if direct message and not an attachment because users can't send those and not hidden
	if(channel.is_im && !message.attachments && !message.hidden){
		var username = app.helpers.getUsernameById(userId);
		// if a process is already in progress
		if(app.userStates.username && app.userStates.username.state){
			// CANCEL EVERYTHING
			if(text.toLowerCase() == 'cancel'){
				respond.cancel(channel, message);
			} else {

				var state = app.userStates.username.state;
				var currentProcess = app.userStates.username.process;

				// i.e. 'announce.general'
				if(currentProcess.indexOf('.') != -1){
					var funcs = currentProcess.split('.');
					respond[funcs[0]][funcs[1]][state](channel, message);
				} else {
					respond[currentProcess][state](channel, message);			
				}
			}
		} else { 
		// process all other messages 
			var todo = processMessage(text);

			// i.e. 'general.start'
			if(todo.indexOf('.') != -1){
				var funcs = todo.split('.');
				if(funcs.length == 2)
					respond[funcs[0]][funcs[1]](channel, message);
				else if(funcs.length == 3)
					respond[funcs[0]][funcs[1]][funcs[2]](channel, message);

			} else {
				respond[todo](channel, message);				
			}
		}
	}
});

// when a new user joins the team
app.slack.on('team_join', function(data){
	console.log(data);
	var greeting = [
		"Welcome to Domi Station! I'm Dom.",
		"You can use me to make room reservations, try messaging me `help` or `snag` :simple_smile:",
		"I'd also recommend setting a profile picture so everyone can recognize you!"
	];
	var user = data.user;

	app.slack.openDM(user.id, function(res){
		var dm_channel = app.slack.getChannelGroupOrDMByID(res.channel.id);
		for(var i = 0; i < greeting.length; i++){
			dm_channel.send(greeting[i]);				
		}
	});

});

// returns a function to be called from the respond object.
// in order of priority
function processMessage(text){
	var func;
	var responses;
	text = text.toLowerCase();


	// SNAG
	//
	if(app.helpers.doesContain(text, 'snag')){
		return 'snag.pick';
	}

	// weekly station announcements
	if(app.helpers.doesContain(text, 'email')){
		return 'announce.email.start';
	}

	// create a general announcement
	if(app.helpers.doesContain(text, 'general')){
		return 'announce.general.start';
	}

	// pick which announcement to make
	if(app.helpers.doesContain(text, 'announce')){
		return 'announce.pick';
	}


	// FOOD
	if(app.helpers.doesContain(text, 'food')){
		return 'food';
	}

	// HELP
	//
	if(app.helpers.doesContain(text, 'help')){
		return 'help';
	}

	// TIP
	//
	if(app.helpers.doesContain(text, ['tip', 'hint'])){
		return 'tip';
	}

	// LOST
	//
	if(app.helpers.doesContain(text, ['lost', 'misplaced'])){
		return 'lost.start';
	}

	// THANKS
	//
	responses = [
		'thanks', 'thank'
	];

	if(app.helpers.doesContain(text, responses)){
		return 'thanks';
	}


	// HELLO
	//
	responses = [
		'hello', 'hey', 'hi', 'dom', 'hola', 'yo'
	];

	if(app.helpers.doesContain(text, responses)){
		return 'hello';
	}
	

	return 'invalid';
}


// object of response functions
var respond = {
	hello: function(channel, message){
		var responses = [
			'Welcome!', 'Aloha!', 'Cheers!', 'Salutations!', 'Hello!', 'Greetings!', 'Bonjour!', 'Good Day!'
		];
		channel.send(app.helpers.pickRandom(responses));
	},

	thanks: function(channel, message){
		var responses = [
			'No problem!', 'Glad to help!', ':smile:', ':blush:'
		];
		channel.send(app.helpers.pickRandom(responses));
	},

	help: function(channel, message){
		var helpString = "Here's a list of commands you can send me :smile: \n" +
			"- `snag` \n - `food` \n - `tips`";

		if(app.helpers.fromAdmin(message)){
			helpString = "Here's a list of commands you can send me :smile: \n" +
			"*general* \n - `snag` \n - `food` \n - `tips` \n - `lost` - work in progress \n *admin* \n - `announce email` \n - `announce general`";
		}
		
		channel.send(helpString);
	},

	invalid: function(channel, message){
		var responses = [
			"I didn't quite catch that.", "Could you try again?"
		];
		channel.send(app.helpers.pickRandom(responses));
	},

	cancel: function(channel, message){
		var username = app.helpers.getUsernameById(message.user);
		var emojis = [':balloon:', ':rotating_light:', ':no_entry_sign:', ':x:'];
		var msg = "The " + app.userStates.username.process + " process you were in has been discarded " + app.helpers.pickRandom(emojis);
		var general = {
			"text": '',
			"attachments": [
		        {
		            "fallback": msg,
		            "color": '#CC4233',
		            "text": msg
		        }
		    ]
		};

		app.helpers.sendAttachment(channel, general, function(){});
		app.userStates.username = {state: false};
	},

	food: function(channel, message){
		var responses = [
			"Merv's makes a mean melt but keep in mind they close at 3pm! \n M-F 8am-3pm   http://mervsonline.com/  (850)765-5222", 
			"Kubano's has the best cuban sandwiches in town, usually open til 10pm! \n  http://www.eatkubano.com/  (850)273-1750"
		];

		channel.send(app.helpers.pickRandom(responses));
	},

	tip: function(channel, message){
		var responses = [
			"Don't forget to clean your own dishes! :droplet::fork_and_knife:", 
			"You can use `today` instead of `[day] [month]` when reserving a room :thumbsup:"
		];

		channel.send(app.helpers.pickRandom(responses));
	},

	// mark something in the digital lost and found
	lost: lost,

	// make a room reservation
	snag: snag,

	// general & email announcements
	announce: announce
		
};




