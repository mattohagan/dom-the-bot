
module.exports = function(app) {
	// return helpers object
	return {

		// pick a random string in a given list
		// used right now to pick from a set of random responses
		pickRandom: function(arr){
			var rand = Math.floor((Math.random() * arr.length));
			return arr[rand];
		},

		// return one of domi's hexcodes
		getDomiHexcode: function(){
			var arr = ['#339999', '#CC4233', '#FF9933'];
			return this.pickRandom(arr);
		},

		// returns if the given text contains any given trigger word(s)
		doesContain: function(text, responses){
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
		},

		// NOT CURRENTLY USED
		// pad a number with a 0 if needed
		// used to output minutes correctly
		padIfNeeded: function(num){
			if(num < 10)
				num = '0' + num;

			return num;
		},

		// return username from id
		getUsernameById: function(userId){
			var user = app.slack.getUserByID(userId);
			return user.name;
		},

		// return true if the message is from an admin
		fromAdmin: function(message){
			var username = this.getUsernameById(message.user);

			if(app.adminUsers.indexOf(username) != -1)
				return true;

			return false;
		},


		sendAttachment: function(channel, data, callback){
			// if a name was passed in instead of channel object
			// then get the actual channel object
			if(typeof(channel) == 'string')
				channel = app.slack.getChannelByName(channel);

			var params = data;
		    params.channel = channel.id;
		    //params.username = 'dom';
		    params.as_user = true;

		    if (data.attachments)
		      params.attachments = JSON.stringify(data.attachments);

		    app.slack._apiCall("chat.postMessage", params, callback);
		}

	}
};