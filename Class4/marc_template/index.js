/*

Node.js parser for MARC Files from Library of Congress
- Make network JSON files for consumption by sigma.js
- npm run download-data to get data files (you may have to install wget)
Jer Thorp (@blprnt)
December, 2017

*/

let request = require('request');
const fs = require('fs');  
const zlib = require('zlib');
const concat = require('concat-stream');
const xml2object = require('xml2object');
const appRoot = require('app-root-path');
const natural = require('natural');
const animals = require(appRoot + '/data/common.json');

//Path to your darta directory
var dataPath = appRoot + "/data";
const marc_location = dataPath;

//Which subset of the MARC files were we looking for?
const filePrefix = "Visual.Materials";
//How many of them are there?
const fileMap = [];
fileMap["Books"] = 				41;
fileMap["Computer.Files"] = 	1; 
fileMap["Maps"] = 				1;
fileMap["Music"] = 				1; 
fileMap["Names"] = 				37; 
fileMap["Serials"] = 			11;
fileMap["Subjects"] = 			2;
fileMap["Visual.Materials"] = 	1;
const fileCount = fileMap[filePrefix];

//List to hold objects we want to write to file at the end
var outList = [];

//XML Parser
var parser;
// Create a new xml parser looking for the record objects
function makeParser() {
	parser = new xml2object([ 'record' ]);
	parser.outs = [];

	parser.on('object', function(name, obj) {
		parseRecord(obj);
	});

	parser.on('end', function() {
	    console.log('Finished parsing xml!');
	    onParseFinished();
	});
}

//Record parser
//Parse MARC record into a usable JSON object
//https://folgerpedia.folger.edu/Interpreting_MARC_records#2xx

const marcDict = {};

//These are the particular MARC fields we're interested in.
marcDict["245"] = {"*" :"Title"};
marcDict["260"] = {"c" :"Year"};
marcDict["100"] = {"a" :"Name"};
marcDict["050"] = {"a" :"CallNumber"};
marcDict["856"] = {"u" :"URL"};

var allRecords = [];
  function parseRecord(obj) {
 	record = {};

	for (var i = 0; i < obj.datafield.length; i++) {
		var df = obj.datafield[i];
		//Get the numeric tag
		var tag  = df.tag;

		//If we have the tag in our dictionary, write to the JSON object
		//Based on the code (doesn't work for all cases?)
		if (marcDict[tag] && df.subfield) {
			var isAll = marcDict[tag]['*'];

			for (var j = 0; j < df.subfield.length; j++) {

				var code = isAll ? "*":df.subfield[j].code;
				var disp = df.subfield[j]['$t'];
				
				if (marcDict[tag][code] || isAll) {
					if (!record[marcDict[tag][code]]) {
						record[marcDict[tag][code]] = [];
					}
					record[marcDict[tag][code]].push(disp);
				}
			}
		}
	}

	//At this point the record object should be populated by our requested fields
	//But it's good to check anyway!

	if (record.Title) {

		if (record.Title.length > 0) {
			//Join the parts of the title into one long string.
			var t = record.Title.join(" ");

			//Check this string for some seed words
			var chk = checkForWords(t, animals.animals);
			if (chk.chk) {
				console.log(chk.w + ":" + t);
				chk.Title = t;
				chk.Year = record.Year;
				chk.URL = record.URL;
				outList.push(chk);
		    }
			
		}
	}
	
}


//Function to check a record for specific words
function checkForWords(_r, _w) {
	var chk = {chk:false, w:null};
	for (var i = 0; i < _w.length; i++) {
		if (_r.indexOf(' ' + _w[i] + ' ') != -1) {
			chk.chk = true;
			chk.w = _w[i];
		}
	}
	return(chk);
}

//This method is called when each file is finished parsing
function onParseFinished() {
	
	//Write every time - useful in very long processes
	writeFile();
	try {
		nextFile();
	} catch(err) {
		//writeColors();
	}
}


var counter = 1;

function nextFile() {
	if (counter < fileCount + 1) {
	  var n = (counter < 10 ? "0":"") + counter;
	  var url = marc_location + "/" + filePrefix + ".2014.part" + n + ".xml.gz";
		var rstream = fs.createReadStream(url);
		var gunzip = zlib.createGunzip();
		makeParser();
		allRecords = [];

		console.log("LOADING FILE : " + url);
		
			rstream   // reads from myfile.txt.gz
			  .pipe(gunzip)  // uncompresses
			  .pipe(parser.saxStream); //Parses into record objects
		
		counter ++;
	}


}

function writeFile() {
	var json = JSON.stringify(outList, null, 2);
	//Write
	console.log("WRITING." + outList.length);
	fs.writeFile(dataPath + "/out" + filePrefix + ".json", json, 'utf8', function() {
		console.log("Saved JSON.");
	});
}

nextFile();



