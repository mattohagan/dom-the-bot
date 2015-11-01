
// todo
// - break out reservation functions
// - break out announcement building?
// - only keep base bot logic in here, so just reacting to messages and pipelining what needs to be done
// - make request to other server and see what happens


var express = require('express');
var app = express();
var dotenv = require('dotenv');
var Slack = require('slack-client');
var request = require('request');
var bodyParser = require('body-parser');
var trim = require('trim');
var moment = require('moment');

app.set('port', (process.env.PORT || 5000));
// needed for parsing requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

dotenv.load();

// set some variables and authorize our slack object
var reservationUrl = "http://domi-room.herokuapp.com/room";
var adminUsers = ['mattohagan', 'christineurban','lucaslindsey', 'sabrinatorres', 'peterpan'];
var slackToken = process.env.DOM_API_TOKEN;
var autoReconnect = true;
var autoMark = true;
slack = new Slack(slackToken, autoReconnect, autoMark);

var reservationQueue = {};

// possible user states: build, finish, false
var userStates = {};

// lost and found
var lostAndFound = [];

// authorize incoming requests
function authRequest(req, res, next){
	var acceptable_tokens = [
		process.env.SNAG_SLACK_TOKEN
	];

	console.log(req.body);

	// check if token is legit
	if(acceptable_tokens.indexOf(req.body.token) === -1){
		res.sendStatus(401);
	}

	next();
}

// app request logic
app.all('*', authRequest);

app.listen(app.get('port'), function() {
    console.log('Server running at port ' + app.get('port').toString());
});


// slack logic
slack.on('open', function(){
	console.log('Connected to '+slack.team.name+' as '+slack.self.name);
});

slack.on('error', function(err){
	console.log(err);
});

slack.login();

// format the json data into a readable response
function formatRequestResponse(data){
	// new Date(year, month, day, hour, minutes);

	var afterMsg = "Shall I snag this room for you? [send or cancel]";
	var response = {
		"text": '',
		"attachments": [
	        {
	            "fallback": "Just to make sure, let's double check your reservation.",

	            "color": '#FF9933',

	            "fields": [
	                {
	                    "title": "Request To Be Made",
	                    "value": "Just to be sure, let's double check everything.",
	                    "short": false
	                },
	                {
	                    "title": "Email",
	                    "value": data.email,
	                    "short": true
	                },
	                {
	                    "title": "Company",
	                    "value": data.company,
	                    "short": true
	                },
	                {
	                    "title": "Date",
	                    "value": data.dateString,
	                    "short": true
	                },
	                {
	                    "title": "Room",
	                    "value": data.room,
	                    "short": true
	                },
	                {
	                    "title": "Start",
	                    "value": data.start,
	                    "short": true
	                },
	                {
	                    "title": "End",
	                    "value": data.end,
	                    "short": true
	                }
	            ]
	        }, {
	        	"text": afterMsg,
	        	"color": "#303030",
	        	"fallback": afterMsg
	        }
	    ]
	};


	return response;
}

//createRequest('east | 11am-1:15pm | 24 oct | HackFSU');
function createRequest(text, userId){
	// create array of data
	var sections = text.split(',');

	// get user email
	var user = slack.getUserByID(userId);
	var email = user.profile.email;
	//var email = 'matt@hackfsu.com';

	// get company name and correct room
	var room = trim(sections[0]);
	room = convertToRoom(room);
	var company = trim(sections[sections.length - 1]);

	// get day and month
	var dayAndMonth = trim(sections[2]);
	var dateObj = parseOutDate(dayAndMonth);
	var day = dateObj.day;
	var month = dateObj.month;

	// get start and end times
	var startAndEnd = trim(sections[1]);
	var timeObj = parseOutTime(startAndEnd);
	var startObj = timeObj.start;
	var endObj = timeObj.end;

	// create user friendly strings
	var startString = moment({hour: startObj.hr, minute:startObj.min}).format('h:mma');
	var endString = moment({hour: endObj.hr, minute:endObj.min}).format('h:mma');

	// create moment object to check if it's before now
	var startMom = moment({month: month, day: day, hour: startObj.hr, minute: startObj.min});
	// check if date is before today's current date
	// if so then make it next year
	// this will mostly be used in december when making january reservations
	if(startMom.isBefore()){
		startMom.add(1, 'years');
	}



	var year = startMom.year();
	// Monday Oct 13th, 2015
	var dateString = startMom.format('dddd MMM Do, YYYY')
	// create date objects that will be used to actually make the request
	var startDate = new Date(year, month, day, startObj.hr, startObj.min);
	var endDate = new Date(year, month, day, endObj.hr, endObj.min);


	var data = {
		"email": email,
		"company": company,
		"room": room,
		"start": startString,
		"end": endString,
		"dateString": dateString,
		"startDate": startDate,
		"endDate": endDate
	};

	console.log(data);
	return data;
}

// take in full time section
// if no colon then minutes = 00
// if pm then hours += 12
// return hours and minutes for start and end in an object
// return false if not valid
function parseOutTime(time){
	var dashIndex = time.indexOf('-');
	if(dashIndex != -1){
		var times = time.split('-');
		var timeObj = parseHrAndMin(times[0]);
		var start = timeObj;

		timeObj = parseHrAndMin(times[1]);
		var end = timeObj;
	} else {
		return false;
	}


	if(!start || !end)
		return false;
	else {
		return {
			start: start,
			end: end
		}
	}
}


// take in a user given time string and return 
// the hours and minutes in an object
// used by parseOutTime()
function parseHrAndMin(str){
	var timeOfDay = [
		'am', 'AM', 'pm', 'PM'
	];
	var hr = null;
	var min = null;
	var hrOffset = 0;
	
	// check to make sure am or pm is there
	for (var i = 0; i < timeOfDay.length; i++) {
		dayTimeInd = str.indexOf(timeOfDay[i]);
		if(dayTimeInd != -1){
			dayTime = timeOfDay[i];
			break;	
		}
	};


	if(dayTimeInd == -1){
		return false;
	}

	// if colon is found
	var colonInd = str.indexOf(':');
	if(colonInd != -1){

		// 1:15pm
		var num = str.substring(0, colonInd);
		hr = parseInt(num);

		num = str.substring(colonInd + 1, dayTimeInd);
		min = parseInt(num);
	} else {
		// 11am
		min = 0;
		var num = str.substring(0, dayTimeInd);
		hr = parseInt(num);
	}

	// offset time if it's pm
	dayTime = dayTime.toLowerCase();
	if(dayTime == 'pm'){
		hr += 12;
	}

	// if anything went wrong in parsing 
	// then return false

	// DONT KNOW HOW OT CHECK IF ITS NOT A NUMBER
	if(hr == NaN)
		return false;

	return {
		hr: hr,
		min: min
	}
}


// parse out the day and month from the 
// date string given by the user
function parseOutDate(date){
	var day;
	var month;

	// if user put 'today'
	if(date == 'today' || date == 'Today' || date == 'TODAY'){
		var today = new Date();
		day = today.getDate();
		month = today.getMonth();
	} else {
		var dayAndMonth = date.split(' ');
		var day = parseInt(trim(dayAndMonth[0]));
		var month = trim(dayAndMonth[1]);

		console.log(day)
		console.log(month)

		// if month is a string then convert to int
		if(isNaN(month)){
			month = monthToInt(month);
		}
	}

	// if month or day is not a number
	if(isNaN(month) || isNaN(day))
		return false;

	// if month or day number is invalid
	if(month < 0 || day < 0 || month > 11 || day > 31)
		return false;

	return {
		day: day,
		month: month 
	};
}

// convert possible spellings of month
// to an integer value between 0 and 11
function monthToInt(month){
	var num;
	switch(month){
		case 'jan':
		case 'january':
			num = 0;
			break;
		case 'feb':
		case 'february':
			num = 1;
			break;
		case 'mar': 
		case 'march':
			num =  2;
			break;
		case 'apr': 
		case 'april':
			num = 3;
			break;
		case 'may':
			num = 4;
			break;
		case 'june':
			num = 5;
			break;
		case 'july':
			num = 6;
			break;
		case 'aug': 
		case 'august':
			num = 7;
			break;
		case 'sep': 
		case 'sept': 
		case 'september':
			num = 8;
			break;
		case 'oct': 
		case 'october':
			num = 9;
			break;
		case 'nov': 
		case 'november':
			num = 10;
			break;
		case 'dec': 
		case 'december':
			num = 11;
			break;
		default:
			num = false;
			break;
	}

	return num;
}

// take in user input of a room and 
// convert to the official request 
function convertToRoom(string){
	string = string.toLowerCase();
	var room;
	switch(string){
		case 'east':
		case 'east conf':
		case 'east conference room':
			room = 'East Conference Room';
			break;
		case 'west':
		case 'west conf':
		case 'west conference room':
			room = 'West Conference Room';
			break;
		case 'florida':
		case 'florida blue':
		case 'florida blue room':
			room = 'Florida Blue Room';
			break;
		default:
			room = false;
			break;
	}

	return room;
}

function makeReservation(userData, callback){

	var data = {
	    "email": userData.email,
	    "company": userData.company,
	    "room": userData.room,
	    "start": userData.startDate,
	    "end": userData.endDate
	 };

	var options = {
		url: reservationUrl,
		method: 'POST',
		json: data
	}

	request.post(options, function(err, response, body){
		if(err){
			console.log('RESERVATION ERROR \n --------------- \n --------- \n ----');
			console.log(response);	
			console.log(err);
		}

		callback(response);
	});

}

slack.on('message', function(message){
	var channel = slack.getChannelGroupOrDMByID(message.channel);
	var text = message.text;
	var userId = message.user;
	if(!userId)
		console.log(message);

	var username = getUsernameById(userId);

	
	// if direct message and not an attachment because users can't send those
	if(channel.is_im && !message.attachments){
		// if a process is already in progress
		if(userStates.username && userStates.username.state){
			var state = userStates.username.state;
			var currentProcess = userStates.username.process;

			respond[currentProcess][state](channel, message);
		} else { 
		// process first response 
			var todo = processMessage(text);

			// i.e. 'general.start'
			if(todo.indexOf('.') != -1){
				var funcs = todo.split('.');
				respond[funcs[0]][funcs[1]](channel, message);
			} else {
				respond[todo](channel, message);				
			}
		}
	}
});

// when a new user joins the team
slack.on('team_join', function(data){
	console.log(data);
	var greeting = [
		"Welcome to Domi Station! I'm Dom.",
		"You can use me to make room reservations, try messaging me `help` or `snag` :simple_smile:",
		"I'd also recommend setting a profile picture so everyone can recognize you!"
	];
	var user = data.user;

	slack.openDM(user.id, function(res){
		var dm_channel = slack.getChannelGroupOrDMByID(res.channel.id);
		for(var i = 0; i < greeting.length; i++){
			dm_channel.send(greeting[i]);				
		}
	});

});

// returns a function to be called from the respond object
function processMessage(text){
	var func;
	var responses;
	text = text.toLowerCase();


	// SNAG
	//
	var sub = text.substring(0, 4);
	sub = sub.toLowerCase();
	if(sub == 'snag'){
		return 'snag.start';
	}

	// weekly station announcements
	if(doesContain(text, 'announcement')){
		return 'announcements.start';
	}

	// general announcement
	if(doesContain(text, 'general')){
		return 'general.start';
	}

	// FOOD
	if(doesContain(text, 'food')){
		return 'food';
	}

	// HELP
	//
	if(doesContain(text, 'help')){
		return 'help';
	}

	// TIP
	//
	if(doesContain(text, ['tip', 'hint'])){
		return 'tip';
	}

	// LOST
	//
	if(doesContain(text, ['lost', 'misplaced'])){
		return 'lost.start';
	}

	// HELLO
	//
	responses = [
		'hello', 'hey', 'hi', 'dom', 'hola'
	];

	if(doesContain(text, responses)){
		return 'hello';
	}

	

	return 'invalid';
}

var generalObj = {
	start: function(channel, message){
		if(fromAdmin(message)){
			var string = "Great, let's send an announcement! What will the title be?";
			var username = getUsernameById(message.user);

			userStates.username = {
				state: 'build',
				process: 'general'
			};

			channel.send(string);
		} else {
			this.invalid(channel, message);
		}
	},

	// build general announcements
	build: function(channel, message){
		var title = trim(message.text);
		var afterMsg = 'Awesome, now what content would you like to put?';
		var general = {
			"text": '',
			"attachments": [
		        {
		            "fallback": title,

		            "color": '#339999',

		            "fields": [
		                {
		                    "title": title,
		                    "value": '< the text you message will go here >',
		                    "short": false
		                }
		            ]
		        }, {
		        	"text": afterMsg,
		        	"color": "#303030",
		        	"fallback": afterMsg
		        }
		    ]
		};

		userStates.username.general = general;

		userStates.username.state = 'finish';

		sendAttachment(channel, general, function(){});

	},

	// general announcements
	finish: function(channel, message){
		var text = message.text;
		var username = getUsernameById(message.user);
		text = text.toLowerCase();

		if(text == 'send'){
			var attach = JSON.parse(userStates.username.general.attachments);

			// get rid of extra attachment that was used to talk to user
			attach.splice(1, 1);

	        var general = {
	        	'text': '',
	        	'attachments': attach
	        };


	        userStates.username = { state: false };

			channel.send('One general announcement, coming right up!');

			// SEND TO #STATIONCHAT
			sendAttachment('stationchat', general, function(){ console.log('Sent general announcement to #stationchat!')});
	        sendAttachment(channel, general, function(){});
		} else if(text == 'cancel'){
			userStates.username = { state: false };
			channel.send('Announcement discarded :thumbsup:');
		} else {
			var attach = JSON.parse(userStates.username.general.attachments);
			attach[0].fields[0].value = message.text;
	        
	        // reset second attachment which asks to send or cancel
			var msg = "Lookin' spiffy. \n ~ Send now? [send] \n ~ Cancel? [cancel]";
			attach[1] = {
	        	"text": msg,
	        	"color": "#303030",
	        	"fallback": msg
	        };

	        var general = {
	        	'text': '',
	        	'attachments': attach
	        };

	        userStates.username.general = general;

	        // send for feedback
	        sendAttachment(channel, general, function(){});
		}
	}
};


// object of response functions
var respond = {
	hello: function(channel, message){
		var responses = [
			'Welcome!', 'Aloha!', 'Cheers!', 'Salutations!', 'Hello!', 'Greetings!', 'Bonjour!', 'Good Day!'
		];
		channel.send(pickRandom(responses));
	},

	help: function(channel, message){

		var helpString = "To reserve a room, follow this format and be sure to include commas! \n"+
		"```snag [east OR west OR florida], [start][am/pm]-[end][am/pm], [day] [month], [company name]```\n"+
		"example use: \n"+
		"```snag east, 11am-1:15pm, 24 oct, HackFSU```";
		channel.send(helpString);
	},

	invalid: function(channel, message){
		var responses = [
			"I didn't quite catch that.", "Could you try again?"
		];
		channel.send(pickRandom(responses));
	},

	food: function(channel, message){
		var responses = [
			"Merv's makes a mean melt but keep in mind they close at 3pm! \n M-F 8am-3pm   http://mervsonline.com/  (850)765-5222", 
			"Kubano's has the best cuban sandwiches in town, usually open til 10pm! \n  http://www.eatkubano.com/  (850)273-1750"
		];

		channel.send(pickRandom(responses));
	},

	tip: function(channel, message){
		var responses = [
			"Don't forget to clean your own dishes! :droplet::fork_and_knife:", 
			"You can use `today` instead of `[day] [month]` when reserving a room :thumbsup:"
		];

		channel.send(pickRandom(responses));
	},

	lost: {
		start: function(channel, message){
			var text = trim(message.text);
			var response = "Oh no! Can you give me a `full description of the lost item`? \n Or `cancel`";

			userStates.username = {
				state: 'confirm',
				process: 'lost'
			};

			channel.send(response);
		},

		confirm: function(channel, message){
			var text = trim(message.text);
			if(text.toLowerCase() == 'cancel'){
				this.cancel(channel);
				return false;
			}

			// create attachment and send to user to confirm
			// save attachment in userState 
			// and save descriptions under username in lostAndFound

			userStates.username = {
				state: 'announce',
				process: 'lost'
			};

			var response = "Sorry, this feature isn't ready yet!";
			channel.send(response);

			this.cancel(channel);
		},

		announce: function(channel, message){
			var text = trim(message.text);
			if(text.toLowerCase() == 'cancel'){
				this.cancel(channel);
				return;
			}

			userStates.username = { state: false };


		},

		cancel: function(channel){
			userStates.username = { state: false };
			channel.send('Lost and found addition discarded :thumbsup:');
		}
	},

	snag: {
		start: function(channel, message){
			var text = trim(message.text);

			if(text.length < 6){
			// NOT ENOUGH INFO
				respond.help(channel, message);
			} else if (text.indexOf(',') == -1){
			// COMMA NOT INCLUDED
				var response = "Don't forget to use commas! Please try again."

				channel.send(response);
			} else {
			// CREATE A ROOM REQUEST
				var username = getUsernameById(message.user);
				// get rid of snag at the beginning
				var sub = text.substring(4);
				var requestText = trim(sub);

				// main parsing of request
				var data = createRequest(requestText, message.user);

				// readable format for user
				var response = formatRequestResponse(data);

				reservationQueue.username = data;

				userStates.username = {
					state: 'finish',
					process: 'snag'
				};

				sendAttachment(channel, response, function(){

				});
			}
		},

		finish: function(channel, message){
			var text = trim(message.text);
			if(text.toLowerCase() == 'send'){
				var username = getUsernameById(message.user);
				makeReservation(reservationQueue.username, function(res){
					var response;
					if(res.statusCode == 200){
						response = 'Room snagged! You should be receiving an email shortly :mailbox_with_mail:';
					} else if (res.statusCode == 500){
						response = 'Oh no! The room has already been snagged, please try again!';
					} else if (res.statusCode == 500){
						response = 'Seems to be something askew, the reservation was not confirmed.';
					} else {
						response = 'Room snagged?';
					}

					channel.send(response);
				});
			}
		}
	},

	// general announcements
	general: generalObj,

	// email & other announcements
	announcements: {
		start: function(channel, message){
			var username = getUsernameById(message.user);

			if(adminUsers.indexOf(username) != -1){
				var string = "Awesome, let's send some announcements! Can you give me the list of Events separated by commas?";

				userStates.username = {
					state: 'build',
					process: 'announcements'
				};

				channel.send(string);
			} else {
				this.invalid(channel, message);
			}

		},

		// events & misc based announcements
		build: function(channel, message){
			var text = message.text;
			if(text.indexOf(',') == -1){
				var string = "Don't forget commas! Try sending me the list of Events again.";
				channel.send(string);
			} else {
				var emojiList = [':loudspeaker:', ':satellite:', ':tv:', ':bell:', ':radio:'];
				var events = text.split(',');
				var today = new Date();
				today = today.getDate() + '/' + (today.getMonth() + 1);
				var title = today + " " + pickRandom(emojiList) + " Station Announcement";

				var fieldText = '';
				for(var i = 0; i < events.length; i++){
					var ev = trim(events[i]);
					fieldText += '- ' + ev + '\n';
				}

				// users options to pick from
				var afterMsg = "Would you like to \n ~ Add a Misc. section [any free form text] \n ~ Send now as an email reminder? [send or send email] \n ~ Send now as just an announcement update? [send other]  \n ~ Cancel? [cancel]";
				var announcement = {
					"text": '',
					"attachments": [
				        {
				            "fallback": title,

				            "color": '#339999',

				            "pretext": "",

				            "title": title,

				            "fields": [
				                {
				                    "title": "Events This Week",
				                    "value": fieldText,
				                    "short": false
				                }
				            ]
				        }, {
				        	"text": afterMsg,
				        	"color": "#303030",
				        	"fallback": afterMsg
				        }
				    ]
				};

				userStates.username.announcement = announcement;

				userStates.username.state = 'finish';

				sendAttachment(channel, announcement, function(){});
			}
		},

		// events & misc based announcements
		finish: function(channel, message){
			var text = message.text;
			var username = getUsernameById(message.user);
			text = text.toLowerCase();

			if(text == 'send' || text == 'send email'){
				var attach = JSON.parse(userStates.username.announcement.attachments);
				// reset second attachment which asks to send or cancel
				var msgs = [
					"All of this info and more can be found in your inbox :mailbox_closed::blush:",
					"Don't forget to check the email for more info! :envelope_with_arrow::thumbsup:"
				];

				var msg = pickRandom(msgs);
				attach[1] = {
		        	"text": msg,
		        	"color": "#303030",
		        	"fallback": msg
		        };

		        var announcement = {
		        	'text': '',
		        	'attachments': attach
		        };

		        userStates.username = { state: false };

				channel.send('One announcement, coming up!');

				// SEND TO #STATIONCHAT
				sendAttachment('stationchat', announcement, function(){ console.log('Sent email announcement to #stationchat!')});
		        sendAttachment(channel, announcement, function(){});
			} else if (text == 'send other'){
				var attach = JSON.parse(userStates.username.announcement.attachments);

		        // remove extra attachment
		        attach.splice(1, 1);

		        var announcement = {
		        	'text': '',
		        	'attachments': attach
		        };

		        userStates.username = { state: false };

				channel.send('One announcement, coming up!');

				// SEND TO #STATIONCHAT
				sendAttachment('stationchat', announcement, function(){ console.log('Sent events announcement to #stationchat!')});
		        sendAttachment(channel, announcement, function(){});
			} else if(text == 'cancel'){
				userStates.username = { state: false };
				channel.send('Announcement discarded :thumbsup:');
			} else {
				var misc = message.text;
				var attach = JSON.parse(userStates.username.announcement.attachments);

				// add misc to fields
				attach[0].fields.push({
					"title": "Misc.",
					"value": misc,
					"short": false
				});

				// reset second attachment which asks to send or cancel
				var msg = "If everything looks up to spec, how should I send this? \n ~ Send as an email reminder? [send or send email] \n ~ Send as just an announcement update? [send other] \n ~ Cancel? [cancel]";
				attach[1] = {
		        	"text": msg,
		        	"color": "#303030",
		        	"fallback": msg
		        };

		        var announcement = {
		        	'text': '',
		        	'attachments': attach
		        };

		        userStates.username.announcement = announcement;

				sendAttachment(channel, announcement, function(){});
			}
		}
	}
};


function sendAttachment(channel, data, callback){
	// if a name was passed in instead of channel object
	// then get the actual channel object
	if(typeof(channel) == 'string')
		channel = slack.getChannelByName(channel);

	var params = data;
    params.channel = channel.id;
    //params.username = 'dom';
    params.as_user = true;

    if (data.attachments)
      params.attachments = JSON.stringify(data.attachments);

    slack._apiCall("chat.postMessage", params, callback);
}




//// UTILITY FUNCTIONS 
////


// pick a random string in a given list
// used right now to pick from a set of random responses
function pickRandom(arr){
	var rand = Math.floor((Math.random() * arr.length));
	return arr[rand];
}

// return one of domi's hexcodes
function getDomiHexcode(){
	var arr = ['#339999', '#CC4233', '#FF9933'];
	return pickRandom(arr);
}

// returns if the given text contains any given trigger word(s)
function doesContain(text, responses){
	var contains = false;

	if(typeof(responses) == 'string'){
		if(text.indexOf(responses) != -1)
			contains = true;
	} else {
		for(var i = 0; i < responses.length; i++){
			if(text.indexOf(responses[i]) != -1){
				contains = true;
				break;
			}
		}
	}

	return contains;
}

// NOT CURRENTLY USED
// pad a number with a 0 if needed
// used to output minutes correctly
function padIfNeeded(num){
	if(num < 10)
		num = '0' + num;

	return num;
}

// return username from id
function getUsernameById(userId){
	var user = slack.getUserByID(userId);
	return user.name;j
}

// return true if the message is from an admin
function fromAdmin(message){
	var username = getUsernameById(message.user);

	if(adminUsers.indexOf(username) != -1)
		return true;

	return false;
}







