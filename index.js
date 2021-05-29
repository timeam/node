var express = require('express');
var request = require('request');
var moment = require('moment');
const cheerio = require('cheerio');
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
var permalink_path_array = new Array();
var ONE_HOUR = 60 * 60 * 1000; /* ms */
var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko';
var source_token = "";
var refresh = "";

var customHeaderRequest = request.defaults({	
  headers: {	
    'User-Agent': USER_AGENT	
  }	
});

app.use(bodyParser.urlencoded({extended: true})) 
app.use(bodyParser.json()) 

app.get('/', function(req, res) {
  if (source_token) {
    res.send((new Date).toISOString() + ' ' + source_token);
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
        var link = process.env.URL_FILTER + links[i].replaceAll("amp;", "");
        if (link.length <= 100 && my_array.indexOf(link) == -1) {
          my_array.push(link)
        }
      }
    }
  } catch (e) {console.log(e)}
}

setInterval(function() {
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
        const ra_options = {
          hostname: process.env.RA_HOSTNAME,
          port: 443,
          path: process.env.RA_PATH + hashtag,
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT
          }
        };
        const ra_req = https.request(ra_options, (res) => {
          res.setEncoding("utf8"); // makes sure that "chunk" is a string.
          let raFullBody = "";
          res.on("data", data => {
            raFullBody += data;
          });
          res.on("end", () => {
            try {
              var url = process.env.WEBHOOK_MANUAL_URL;
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
              const $ = cheerio.load(raFullBody);
              var text_header = $('h1.header').first().text();
              if (typeof text_header !== 'undefined' && text_header !== false && text_header !== "") {
                player_name = text_header.trim() + ' ';
              }
              var text_item = $('div.horizontal').first().children().first().text();
              if (typeof text_item !== 'undefined' && text_item !== false && text_item !== "") {
                trophies = text_item.trim().replace(/\s{2,}/g, ' ');
                var numbers = trophies.match(/\d+/g).map(Number);
                for( i=0; i<numbers.length; i++ ) {
                  if (numbers[i] > highest_trophies)
                    highest_trophies = numbers[i];
                }
              } else {
                url = process.env.WEBHOOK_UNKNOWN_URL;
              }
              var text_td_best_season_rank = $("img[src$='rank.png']").first().parent().find('tr').eq(2).find('td').eq(1).text();
              if (typeof text_td_best_season_rank !== 'undefined' && text_td_best_season_rank !== false && text_td_best_season_rank !== "") {
                best_season_rank = text_td_best_season_rank.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_best_season = $("img[src$='rank.png']").first().parent().find('tr').eq(3).find('td').eq(1).text();
              if (typeof text_td_best_season !== 'undefined' && text_td_best_season !== false && text_td_best_season !== "") {
                best_season = text_td_best_season.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_best_season_date = $("img[src$='rank.png']").first().parent().find('tr').eq(4).find('td').eq(1).text();
              if (typeof text_td_best_season_date !== 'undefined' && text_td_best_season_date !== false && text_td_best_season_date !== "") {
                best_season_date = text_td_best_season_date.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_previous_season = $("img[src$='rank.png']").first().parent().find('tr').eq(-2).find('td').eq(1).text();
              if (typeof text_td_previous_season !== 'undefined' && text_td_previous_season !== false && text_td_previous_season !== "") {
                previous_season = text_td_previous_season.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_previous_season_best = $("img[src$='rank.png']").first().parent().find('tr').eq(-1).find('td').eq(1).text();
              if (typeof text_td_previous_season_best !== 'undefined' && text_td_previous_season_best !== false && text_td_previous_season_best !== "") {
                previous_season_best = " / " + text_td_previous_season_best.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_max_wins = $("img[src$='tournament.png']").first().parent().find('tr').eq(1).find('td').eq(1).text();
              if (typeof text_td_max_wins !== 'undefined' && text_td_max_wins !== false && text_td_max_wins !== "") {
                max_wins = text_td_max_wins.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_cards_won = $("img[src$='tournament.png']").first().parent().find('tr').eq(2).find('td').eq(1).text();
              if (typeof text_td_cards_won !== 'undefined' && text_td_cards_won !== false && text_td_cards_won !== "") {
                cards_won = text_td_cards_won.trim().replace(/\s{2,}/g, ' ');
              }
              var text_td_experience = $("img[src$='cards.png']").first().parent().find('tr').eq(0).find('td').eq(1).text();
              if (typeof text_td_experience !== 'undefined' && text_td_experience !== false && text_td_experience !== "") {
                experience = text_td_experience.trim().replace(/\s{2,}/g, ' ');
              }
              if (trophies.includes('7,') || trophies.includes('8,') || trophies.includes('N/A') || highest_trophies >= 7000 || DEBUG_MODE) {
                if (DEBUG_MODE) {
                  url = process.env.WEBHOOK_DEBUG_URL;
                }
                request({
                  url: url,
                  method: "POST",
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
                }, function(error, response, body) {
                  if (error) {
                    console.log(error);
                    //my_array.unshift(temp_obj);
                  }
                });
              }
            } catch (e) {}
          });
        });
        ra_req.on('error', (e) => {
          console.error(e);
        });
        ra_req.end();
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
                if(START_TIME <= h && h < END_TIME && refresh) {
                  var items = {};
                  for (url in article["entities"]["urls"]) {
                    if ("expanded_url" in article["entities"]["urls"][url]) {
                      items[article["entities"]["urls"][url]["expanded_url"]] = true;
                    }
                  }
                  for (var i in items) {
                    processData(i);
                  }                            }
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


setInterval(function() {
  try {
    var d = new Date((new Date).getTime());	
    var h = d.getUTCHours();
    if (h < 12) {	
      customHeaderRequest.get(process.env.AM_URL, function(err, resp, body) {});	
    } else {	
      customHeaderRequest.get(process.env.PM_URL, function(err, resp, body) {});	
    }	
    if (h == 23) {	
      customHeaderRequest.get(process.env.AM_URL, function(err, resp, body) {});	
    }	
    if (h == 11) {	
      customHeaderRequest.get(process.env.PM_URL, function(err, resp, body) {});	
    }
  } catch (error) {
    console.log(error);
  }
}, 300000); // every 5 minutes (300000) */
