var express = require('express');
var moment = require('moment');
const jsesc = require('jsesc');
const https = require('https');
const path = require('path');
var bodyParser = require('body-parser');
const got = require("got");

const DEBUG_MODE = (process.env.DEBUG.toUpperCase() === "TRUE");
const START_TIME = Number(process.env.START_TIME);
const END_TIME = Number(process.env.START_TIME);

var app = express();
var my_array = new Array();
var ONE_HOUR = 60 * 60 * 1000; /* ms */
var source_token = "";
var refresh = "";

app.use(bodyParser.urlencoded({extended: true})) 
app.use(bodyParser.json()) 

app.get('/', function(req, res) {
  if (source_token) {
    res.send((new Date).toISOString() + ' ' + source_token + refresh);
  } else {
    res.send((new Date).toISOString() + ' waiting...');
  }
});

app.get('/subscribe', function (req, res) {
  res.sendFile(path.join(__dirname + '/subscribe.html'));
});

app.post('/subscription', function(req, res){
  if (req.body.email) {
    processData(req.body.email);
  }
  res.redirect('/');
});

app.listen(process.env.PORT || 3000);

async function processData(stringData) {
  try {
    var links = stringData.match(/[A-Za-z]{2,3}\?tag=.*?platform=[a-zA-Z0-9_\-]*/ig);
    if (links != null){
      for( i=0; i<links.length; i++ ) {
        var link = process.env.URL_FILTER + links[i].replace(/amp;/g, "");
        if (link.length <= 100 && my_array.indexOf(link) == -1) {          
          my_array.push(link)
        }
      }
    }
  } catch (e) {console.log(e)}
}

setInterval(async function() {
  var temp_obj = my_array.pop();
  if (temp_obj != undefined) {
    var temp_data_expanded_url = temp_obj;
    if (temp_data_expanded_url.startsWith(process.env.URL_FILTER) && temp_data_expanded_url.includes('tag')) {
      var re = /.*tag=(.*?)&.*/;
      var hashtag = temp_data_expanded_url.replace(re, "$1");
      if (hashtag && hashtag != 'Y8LRCLVC') {
        var player_profile =
          "<" + encodeURI(process.env.SR_URL + hashtag) + ">\n" +
          "<" + encodeURI(process.env.DS_URL + hashtag) + ">\n" +
          "<" + encodeURI(process.env.RA_URL + hashtag) + ">";
        var friend_link = encodeURI(temp_data_expanded_url);
        var goqrme = encodeURI(process.env.QR_URL) + encodeURIComponent(temp_data_expanded_url);
        var player_post =
          "<" + encodeURI(process.env.QUERY_URL).replace('QUERY',  encodeURIComponent(temp_data_expanded_url.replace("https://", ""))) + ">";
  
        try {
          var url = process.env.WEBHOOK_FILTERED_URL;
          var player_name = "N/A";
          var trophies = "N/A";
          var highest_trophies = 0;
          var best_season = "N/A";
          var best_season_rank = "N/A";
          var best_season_date = "N/A";
          var previous_season = "N/A";
          var previous_season_best = "";
          var max_wins = "N/A";
          var cards_won = "N/A";
          var experience = "N/A";

          const API_players_response = await got(process.env.API_URL_DOMAIN +"/v1/players/%23" + hashtag, {
            headers: {
              "Accept":"application/json",
              "authorization":"Bearer " + process.env.API_BEARER
            }
          });

          if (API_players_response.statusCode == 200) {
            var api_json_data = JSON.parse(API_players_response.body);
            if ('name' in api_json_data) {
              player_name = api_json_data['name'];
            }
            if ('trophies' in api_json_data) {
              trophies = api_json_data['trophies'];
            }
            if ('bestTrophies' in api_json_data) {
              highest_trophies = api_json_data['bestTrophies'];
            } else {
              url = process.env.WEBHOOK_UNKNOWN_URL;
            }  
            if ('leagueStatistics' in api_json_data){
              leagueStatistics = api_json_data['leagueStatistics'];
              if ('previousSeason' in leagueStatistics) {
                previousSeason = leagueStatistics['previousSeason'];
                if ('trophies' in previousSeason) {
                  previous_season = previousSeason['trophies'];
                }
                if ('bestTrophies' in previousSeason) {
                  previous_season_best = " / " + previousSeason['bestTrophies'];
                }
              }
              if ('bestSeason' in leagueStatistics) {
                bestSeason = leagueStatistics['bestSeason'];
                if ('trophies' in bestSeason) {
                  best_season = bestSeason['trophies'];
                }
                if ('rank' in bestSeason) {
                  best_season_rank = bestSeason['rank'];
                }
                if ('id' in bestSeason) {
                  best_season_date = bestSeason['id'];
                }
              }
            }
            if ('challengeMaxWins' in api_json_data) {
              max_wins = api_json_data['challengeMaxWins'];
            }
            if ('challengeCardsWon' in api_json_data) {
              cards_won = api_json_data['challengeCardsWon'];
            }
            if ('expLevel' in api_json_data) {
              experience = api_json_data['expLevel'];
            }
          } else {
            url = process.env.WEBHOOK_UNKNOWN_URL;
            console.log(API_players_response.statusCode);
          }
      
          if (highest_trophies >= 7000 || process.env.WEBHOOK_UNKNOWN_URL === url || DEBUG_MODE) {
            if (DEBUG_MODE) {
              url = process.env.WEBHOOK_DEBUG_URL;
            }
            const body = await got.post(url, {
              json: {
                "username": "Tweet",
                "avatar_url": "https://i.imgur.com/q3iAY1B.png",
                "embeds": [{
                  "author": {
                    "name": player_name + "#" + hashtag,
                    "icon_url": "https://i.imgur.com/nMRazCT.png"
                  },
                  "color": 5746931,
                  "fields": [{
                      "name": "Trophies",
                      "value": trophies
                    },
                    {
                      "name": "Best Season Rank",
                      "value": best_season_rank
                    },
                    {
                      "name": "Best Season Trophies",
                      "value": best_season
                    },
                    {
                      "name": "Best Season Date",
                      "value": best_season_date
                    },
                    {
                      "name": "Previous Season",
                      "value": previous_season + previous_season_best
                    },
                    {
                      "name": "Max Wins",
                      "value": max_wins
                    },
                    {
                      "name": "Cards Won",
                      "value": cards_won
                    },
                    {
                      "name": "Experience",
                      "value": experience
                    },
                    {
                      "name": "Player Profile",
                      "value": player_profile
                    },
                    {
                      "name": "Post",
                      "value": player_post
                    },
                    {
                      "name": "Friend Link",
                      "value": friend_link
                    }
                  ],
                  "image": {
                    "url": goqrme
                  },
                  "footer": {
                    "text": moment(new Date((new Date).getTime())).format('YYYY-MM-DD[T]HH:mm:ss.SSS') + "Z"
                  }
                }]
              }
            }).json();
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
  }
}, 6457); // every 6.457 seconds (6457)


setInterval(async function() {
  try {
    if (source_token) {
      temp_source_json_url = process.env.SOURCE_JSON_URL.replace("typed_query" , "typed_query" + refresh);
      const temp_source_json_url_response = await got(temp_source_json_url, {
        headers: {
          "x-guest-token": source_token,
          "Authorization": "Bearer " + process.env.SOURCE_BEARER,
          "Referer": process.env.SOURCE_URL
        }
      });
      var json_data = JSON.parse(temp_source_json_url_response.body);
      if (json_data.globalObjects && json_data.globalObjects.tweets) {
        var json_root = json_data["globalObjects"]["tweets"];
        for (item in json_root) {
          var article = json_root[item]
          if (article.entities) {
            var date_time = new Date(Date.parse(article["created_at"].replace(/( \+)/, ' UTC$1')));
            var h = date_time.getUTCHours();
            if((START_TIME <= h && h < END_TIME && refresh) || DEBUG_MODE) {
              var items = {};
              for (url in article["entities"]["urls"]) {
                items[article["entities"]["urls"][url]["expanded_url"]] = true;
              }
              for (var i in items) {
                processData(i);
              }   
            }
          }
        }
      }
      
      if (json_data.timeline && json_data.timeline.instructions) {
        var entries;
        for (instruction in json_data["timeline"]["instructions"]) {
          if ("addEntries" in json_data["timeline"]["instructions"][instruction]) {
            entries = json_data["timeline"]["instructions"][instruction]["addEntries"]["entries"];
          } else if ("replaceEntry" in json_data["timeline"]["instructions"][instruction]) {
            entries = [json_data["timeline"]["instructions"][instruction]["replaceEntry"]["entry"]];
          } else {
            continue;
          }
          for (entry in entries) {
            if (entries[entry]["entryId"] == "sq-cursor-top" || entries[entry]["entryId"].startsWith("cursor-top-")) {
              refresh = "&cursor=" + encodeURIComponent(entries[entry]["content"]["operation"]["cursor"]["value"]);
            }
          }
        }
      }
    } else {
      const source_url_response = await got(process.env.SOURCE_URL);
      var myRegexp = /gt=(\d+)/ig;
      var match = myRegexp.exec(source_url_response.body);
      source_token = match[1];
      if(match.length > 0){
        source_token = match[1];
      }
    }
  } catch (error) {
    source_token = "";
    refresh = "";
    console.log(error);
  }
}, 30000); // every 30.000 seconds (30000)


setInterval(async function() {
  try {
    var d = new Date((new Date).getTime());	
    var h = d.getUTCHours();
    if (h < 12) {	
      got(process.env.AM_URL);	
    } else {	
      got(process.env.PM_URL);	
    }	
    if (h == 23) {	
      got(process.env.AM_URL);	
    }	
    if (h == 11) {	
      got(process.env.PM_URL);	
    }
  } catch (error) {
    console.log(error);
  }
}, 300000); // every 5 minutes (300000) */
