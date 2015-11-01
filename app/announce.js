// functions to handle announcements
module.exports = function(app){
	// return announce object
	return {
		general: {
			start: function(channel, message){
				if(app.helpers.fromAdmin(message)){
					var string = "Great, let's send an announcement! What will the title be?";
					var username = app.helpers.getUsernameById(message.user);

					app.userStates.username = {
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
				var title = app.helpers.trim(message.text);
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

				app.userStates.username.general = general;

				app.userStates.username.state = 'finish';

				app.helpers.sendAttachment(channel, general, function(){});

			},

			// general announcements
			finish: function(channel, message){
				var text = message.text;
				var username = app.helpers.getUsernameById(message.user);
				text = text.toLowerCase();

				if(text == 'send'){
					var attach = JSON.parse(app.userStates.username.general.attachments);

					// get rid of extra attachment that was used to talk to user
					attach.splice(1, 1);

			        var general = {
			        	'text': '',
			        	'attachments': attach
			        };


			        app.userStates.username = { state: false };

					channel.send('One general announcement, coming right up!');

					// SEND TO #STATIONCHAT
					app.helpers.sendAttachment('stationchat', general, function(){ console.log('Sent general announcement to #stationchat!')});
			        app.helpers.sendAttachment(channel, general, function(){});
				} else if(text == 'cancel'){
					app.userStates.username = { state: false };
					channel.send('Announcement discarded :thumbsup:');
				} else {
					var attach = JSON.parse(app.userStates.username.general.attachments);
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

			        app.userStates.username.general = general;

			        // send for feedback
			        app.helpers.sendAttachment(channel, general, function(){});
				}
			}
		},

		email: {
			start: function(channel, message){
				var username = app.helpers.getUsernameById(message.user);

				if(adminUsers.indexOf(username) != -1){
					var string = "Awesome, let's send some announcements! Can you give me the list of Events separated by commas?";

					app.userStates.username = {
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
					var title = today + " " + app.helpers.pickRandom(emojiList) + " Station Announcement";

					var fieldText = '';
					for(var i = 0; i < events.length; i++){
						var ev = app.helpers.trim(events[i]);
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

					app.userStates.username.announcement = announcement;

					app.userStates.username.state = 'finish';

					app.helpers.sendAttachment(channel, announcement, function(){});
				}
			},

			// events & misc based announcements
			finish: function(channel, message){
				var text = message.text;
				var username = app.helpers.getUsernameById(message.user);
				text = text.toLowerCase();

				if(text == 'send' || text == 'send email'){
					var attach = JSON.parse(app.userStates.username.announcement.attachments);
					// reset second attachment which asks to send or cancel
					var msgs = [
						"All of this info and more can be found in your inbox :mailbox_closed::blush:",
						"Don't forget to check the email for more info! :envelope_with_arrow::thumbsup:"
					];

					var msg = app.helpers.pickRandom(msgs);
					attach[1] = {
			        	"text": msg,
			        	"color": "#303030",
			        	"fallback": msg
			        };

			        var announcement = {
			        	'text': '',
			        	'attachments': attach
			        };

			        app.userStates.username = { state: false };

					channel.send('One announcement, coming up!');

					// SEND TO #STATIONCHAT
					app.helpers.sendAttachment('stationchat', announcement, function(){ console.log('Sent email announcement to #stationchat!')});
			        app.helpers.sendAttachment(channel, announcement, function(){});
				} else if (text == 'send other'){
					var attach = JSON.parse(app.userStates.username.announcement.attachments);

			        // remove extra attachment
			        attach.splice(1, 1);

			        var announcement = {
			        	'text': '',
			        	'attachments': attach
			        };

			        app.userStates.username = { state: false };

					channel.send('One announcement, coming up!');

					// SEND TO #STATIONCHAT
					app.helpers.sendAttachment('stationchat', announcement, function(){ console.log('Sent events announcement to #stationchat!')});
			        app.helpers.sendAttachment(channel, announcement, function(){});
				} else if(text == 'cancel'){
					app.userStates.username = { state: false };
					channel.send('Announcement discarded :thumbsup:');
				} else {
					var misc = message.text;
					var attach = JSON.parse(app.userStates.username.announcement.attachments);

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

			        app.userStates.username.announcement = announcement;

					app.helpers.sendAttachment(channel, announcement, function(){});
				}
			}
		}
	}
};