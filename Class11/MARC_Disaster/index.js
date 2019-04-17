/*

MARC List Example
Jer Thorp
3/11/19

- npm install
- npm run download-data
- npm start

NOTE: You will need to have the URLs you'd like the download script to get listed in data/urls.txt
NOTE: If the download-data command doesn't work you probably need to install wget:
	OSX: brew install wget
	Windows: http://gnuwin32.sourceforge.net/packages/wget.htm

This example runs through the Visual Materials and makes a data file recording how many items were
published in each given year.

This tactic could be used to get distribution data for any MARC field - and could be filtered by
title keyword (see CleanMARC example)

*/

//We're using the xml2object package, which takes XML loaded as text and parses it into a javascript object
const xml2object = require('xml2object');
//The filesystem package is used to load the .gz files from the local directory
const fs = require('fs');  
//The zlib package is used to unzip the .gz files
const zlib = require('zlib');
//I like to use this package which provides a clean way to reference to root directory of a node project
const appRoot = require('app-root-path');
//Natural is a nice NLP package for node: https://www.npmjs.com/package/natural
const natural = require('natural');

//Where is the data?
var dataPath = appRoot + "/data";

//Which subset of the MARC files were we looking for?
const filePrefix = "Maps";
//How many of them are there?
const fileMap = [];
fileMap["BooksAll"] = 			41;
fileMap["Computer.Files"] = 	1; 
fileMap["Maps"] = 				1;
fileMap["Music"] = 				1; 
fileMap["Names"] = 				37; 
fileMap["Serials"] = 			11;
fileMap["Subjects"] = 			2;
fileMap["Visual.Materials"] = 	1;
//Total number of files to load
const fileCount = fileMap[filePrefix];
//Number of files we've already loaded
//We start at 1 because the MARC files are 1-indexed
var fileCounter = 1;

//Counter to keep track of years
var outCounter = {};

//Array to hold CSV outs
var rows = [];

//Search word
var search = "fire";

//The xml2object package needs us to build a parser object - that will ingest the XML and then
//trigger functions when the parse is complete. 
const parser = new xml2object([ 'record' ]);

//XML PARSER ---------------------------------------------------------------------------!!
//When we construct the parser with an array of which xml elements to look for. In our case, we're
//interested in the record objects. We also can pass in a reference to the file name.
function makeParser() {

	//The parser's on method handles events. Here, we'll define what happens when it finishes parsing an object 
	parser.on('object', function(name, obj) {

	  	//Get the Year of the object from subfield 260
	  	var marcDict = {};
	  	marcDict["245"] = {"*" :"Title"};
	  	marcDict["260"] = {"c" :"Year"};
	  	marcDict["752"] = {"*" : "Location"};
	  	marcDict["650"] = {"a" : "Subject"};
	  	

	  	var record = parseRecord(obj, marcDict);

	  	var year = record.Year;
	  	if (record.Year) {
	  		var cy;
	  		try {
	  			cy = record.Year[0].replace(/-/g, "5");
	  			cy = cy.replace(/[.,\/#!$%\^&\*\[\];:{}=\-_`~()]/g,"");

	  			var yearRegex = /(\d{4})/;///(\d{4}|\d{4}\-\d{4})$/g;
	  			///(17|18|19|20)\d{2}/

	  			var y = cy.match(yearRegex)[0];
	  			if (y) year = y;
		  	} catch (error) {
		  		//console.log("failed year extract" + record.Year);
		  		//console.log(cy);
		  	}
	  	}

	  	if (record.Location && record.Title) {
	  		var chk1 = checkForMatches(record.Title.join(" ").toLowerCase(), ["hazard","fire","flood","storm","tornado","earthquake"]).chk;
	  		var chk2;
	  		if (record.Subject) {
	  			chk2 = checkForMatches(record.Subject.join(" ").toLowerCase(), ["hazard","fire","flood","storm","tornado","earthquake"]).chk
	  		}
	  		if (chk1 || chk2) {
	  			rows.push([record.Title.join(" ") + "	" + year + "	" + record.Location. join(" ")]);	
	  			console.log(record);
	  		}
	  	}
	});

	//And what happens when it finishes parsing all of the records. 
	parser.on('end', function() {
	    onParseFinished();
	}); 

}

//------------------CHECK FOR MATCHES FUNCTION ---------------------------------------------------------------------------!!
//This function checks any string (input) against any list of candidate strings (candidates)
//Uses NLP to split the sentence into words and also to stem
var tokenizer = new natural.TreebankWordTokenizer();
//Used to singularize the words so that frogs matches frog. Wether or not you have to do this will depend on what data you're trying to match.
//For example if it's something *already* standardized (ie. Subjects) you won't have to. 
//This function is SLOW if there are a lot of words to check against 
var nounInflector = new natural.NounInflector();

function checkForMatches(input, candidates) {

	//Tokenize the record (break it into words)
	var words = [tokenizer.tokenize(input)][0];

	//Set up our return object, this is the state that is returned with no matches
	var chk = {chk:false, words:[]};
	
	for (var i = 0; i < candidates.length; i++) {
		var cand = nounInflector.singularize(candidates[i].toLowerCase());
		for (var j = 0; j < words.length; j++) {
			if (nounInflector.singularize(words[j].toLowerCase()) == cand) {
				chk.chk = true;
				chk.words.push(candidates[i]);
			}
		}
	}

	//Returns an object with a boolean and a list of words (if any)
	//ie {chk:true, words:["frog","monkey"]}
	return(chk);
}

//MARC PARSE FUNCTION ---------------------------------------------------------------------------!!
//This function expects an object from xml2obj, and a dictionary object which links
//the mark tags and subfields to a property name.
//
//For example, you could do this:
//  marcDict["260"] = {"c" :"Year"};
//
//Which asks the parser to link records with a tag of 260 and a subfield of c to the property Year.
//
//You can also use * to say you want ALL subfields of a tag to be stored in a property:
//
//	marcDict["245"] = {"*" :"Title"};

function parseRecord(obj, marcDict) {
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
	return(record);	
}


//FILE LOADING CASCADE ---------------------------------------------------------------------------!!
//These two functions sequence through the list of MARC records one by one and process them with our 
//xml2object parser
function loadNextFile() {
	if (fileCounter <= fileCount) {
		//Put a zero in file names under 10
		var n = (fileCounter < 10 ? "0":"") + fileCounter;
		//Construct the URL
		var url = dataPath + "/" + filePrefix + ".2014.part" + n + ".xml.gz";
		//Open up a read stream and unzip it

		
			var rstream = fs.createReadStream(url);
			var gunzip = zlib.createGunzip();
			 	
			rstream   // reads from the url we've constructed
			  .pipe(gunzip)  // uncompresses
			  .pipe(parser.saxStream); //Parses into record objects
				
			fileCounter ++;
			console.log("LOADING FILE : " + url);
		
	}
}


function onParseFinished() {
	
	//Write every time - useful in very long processes
	writeFile(rows);
	try {
		loadNextFile();
	} catch(err) {
		console.log("ERROR LOADING NEXT FILE: " + fileCounter);
	}
}

//File WRITER ---------------------------------------------------------------------------!!

function writeFile(rows) {
	var text = rows.join("\n");
	//Write
	//File prefix is defined on line 26
	fs.writeFile(appRoot + "/out/" + search + ".tsv", text, 'utf8', function() {
		console.log("Saved JSON.");
	});
}

//PULL THE TRIGGER.
makeParser();
loadNextFile();



