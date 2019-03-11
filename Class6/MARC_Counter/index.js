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

//Where is the data?
var dataPath = appRoot + "/data";

//Which subset of the MARC files were we looking for?
const filePrefix = "Visual.Materials";
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
	  	marcDict["260"] = {"c" :"Year"};

	  	var record = parseRecord(obj, marcDict);

	  	//****************************** HERE'S THE PIECE OF CODE THAT ACTUALLY DOES THE THING!!***********
	  	if (record.Year) {
	  		
	  		//Clean up the year using a regular expression.
	  		//This one looks for the numbers 17,18,19 or 2 followed by two zeroes

	  		try {
				var y = record.Year[0].match(/(17|18|19|20)\d{2}/)[0];
			  	//Does the counter already have an object for this year?
			  	if (outCounter[y]) {
			  		//increase the counter by 1
			  		outCounter[y].count ++;
			  	} else {
			  		//If not, we make it an init that object with a count of 1
			  		outCounter[y] = {"Year": y, count:1};
			  	}
			  } catch (error) {
			  	//Tell us which ones didn't match the regex in case we want to try to make it better
			  	//(Right now it mostly fails on years that are not cleary known and are listed as 192-? or such)
			  	console.log("RegEx failed on:" + record.Year);
			  }
	    }
	});

	//And what happens when it finishes parsing all of the records. 
	parser.on('end', function() {
	    onParseFinished();
	}); 

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
	writeFile(outCounter);
	try {
		loadNextFile();
	} catch(err) {
		console.log("ERROR LOADING NEXT FILE: " + fileCounter);
	}
}

//JSON WRITER ---------------------------------------------------------------------------!!
//Writes any JSON object to a file
function writeFile(json) {
	var json = JSON.stringify(json, null, 2);
	//Write
	console.log("WRITING." + json.length);
	//File prefix is defined on line 26
	fs.writeFile(appRoot + "/out/output_" + filePrefix + ".json", json, 'utf8', function() {
		console.log("Saved JSON.");
	});
}

//PULL THE TRIGGER.
makeParser();
loadNextFile();



