/*

MARC Network Example
Jer Thorp
3/11/19

- npm install
- npm run download-data
- npm start

NOTE: You will need to have the URLs you'd like the download script to get listed in data/urls.txt
NOTE: If the download-data command doesn't work you probably need to install wget:
	OSX: brew install wget
	Windows: http://gnuwin32.sourceforge.net/packages/wget.htm

This example runs through the Boooks and finds entries that contain animal names.
It then builds a data file for use with sigma.js showing a network of how the animal names are connected.

NOTE: This file takes a while to run ~15m per MARC file.

This tactic could be used to get distribution data for any MARC field - and could be filtered by
title keyword (see CleanMARC example)

Output can be viewed here: https://marc-books-animal.glitch.me/

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


//This the list of animals - from Darius Kazemi (https://github.com/dariusk/corpora)
const animals = require(dataPath + "/animals.json");

//Which subset of the MARC files were we looking for?
const filePrefix = "BooksAll";
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


//------------------XML PARSER ---------------------------------------------------------------------------!!
//When we construct the parser with an array of which xml elements to look for. In our case, we're
//interested in the record objects. We also can pass in a reference to the file name.
function makeParser() {

	//The parser's on method handles events. Here, we'll define what happens when it finishes parsing an object 
	parser.on('object', function(name, obj) {

	  	//Get the Year of the object from subfield 260
	  	var marcDict = {};
	  	marcDict["245"] = {"*" :"Title"};

	  	var record = parseRecord(obj, marcDict);

	  	//****************************** HERE'S THE PIECE OF CODE THAT ACTUALLY DOES THE THING!!***********
	  	if (record.Title) {
	  		//First we want to see if the full title matches any of our clothing words.
	  		//We use a bit of natural language processing for this - first to split the title into tokens
	  		//And then to stem the word so that 'horses' and 'horse' both match the same thing
	  		var fullTitle = record.Title.join(" ");
	  		var checked = checkForMatches(fullTitle, animals.animals);
	  		if (checked.chk) {
	  			//We found (at least one) match! Hurray!
	  			//We're interested in the ones that have more than one - these are the data points for our network
	  			if (checked.words.length > 1) {
	  				console.log("NETWORK ENTRY: " + checked.words);
	  				fileNetworkEntry('animals', checked.words);
	  			}
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




//------------------SIGMA.JS DATA FUNCTION ---------------------------------------------------------------------------!!
//Builds network objects to match the format required by sigma.js
//		- http://sigmajs.org/
//Multiple network objects can be built at once by passing in unique network keys
const networkMap = {};

function fileNetworkEntry(networkKey, entryArray) {
	//Does the key exist? If not create a new network object
	if (!networkMap[networkKey]) {
		networkMap[networkKey] = {"network":{"nodes":[], "edges":[]}, "maps":{"nodes":{}}};
		//Tell us that a new key has been created
		console.log("CREATED KEY:" + networkKey)
	}

	//Retrieve the network by its key
	var network = networkMap[networkKey];

	//Make a node object for each item in the entryArray
	/*

	{
      "id": "n0",
      "label": "A node",
      "x": 0,
      "y": 0,
      "size": 3
    }

    */
	for (var i = 0; i < entryArray.length; i++) {
		var nodeName = entryArray[i];
		if (!network.maps.nodes[nodeName]) {
			var n = {
				"id":"n" + network.network.nodes.length,
				"label": nodeName,
				"x": Math.random() * 100,
				"y": Math.random() * 100,
				"size":1
			};
			network.maps.nodes[nodeName] = n;
			network.network.nodes.push(n);
		}

		network.maps.nodes[nodeName].size ++;
	}

	//Make edge objects
	/*

	 {
      "id": "e0",
      "source": "n0",
      "target": "n1"
    }

    */

	for (var i = 0; i < entryArray.length; i++) {
		var nodeName = entryArray[i];
		var n1 = network.maps.nodes[nodeName];
		for (var j = i + 1; j < entryArray.length; j++) {
			if (i != j) {
				var nodeName2 = entryArray[j];
				var n2 = network.maps.nodes[nodeName2];
				var e = {
					"id": "e" + network.network.edges.length,
					"source": n1.id,
					"target": n2.id
				};
				network.network.edges.push(e);

			}
		}
	}

}

//Saves out a particular network key to a file.
function saveNetwork(name) {
	var network = networkMap[name];
	var json = JSON.stringify({"nodes":network.network.nodes, "edges":network.network.edges}, null, 2);
	//Write
	fs.writeFile(name + '_network.json', json, 'utf8', function() {
		console.log("Saved " + name + " JSON.");
	});
}




//------------------MARC PARSE FUNCTION ---------------------------------------------------------------------------!!
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





//------------------ FILE LOADING CASCADE ---------------------------------------------------------------------------!!
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
	saveNetwork('animals');
	try {
		loadNextFile();
	} catch(err) {
		console.log("ERROR LOADING NEXT FILE: " + fileCounter);
	}
}




//------------------ JSON WRITER ---------------------------------------------------------------------------!!
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



