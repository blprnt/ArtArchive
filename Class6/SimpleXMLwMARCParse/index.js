/*

Simple XML load example w/ MARC parser
Jer Thorp
3/11/19

This example shows how to process an XML data point into a JS object, and how send that result to the 
MARC parser along with a dictionary object defining what information we're interested in.

Usage: 

- npm install
- node index.js

*/

//We're using the xml2object package, which takes XML loaded as text and parses it into a javascript object
const xml2object = require('xml2object');

//We'll point to a sample MARC file which I created from a small set of book records 
const sampleMARCFile = 'sampleMARC.xml';

//The xml2object package needs us to build a parser object - that will ingest the XML and then
//trigger functions when the parse is complete. 
const parser = new xml2object([ 'record' ], sampleMARCFile);

//When we construct the parser with an array of which xml elements to look for. In our case, we're
//interested in the record objects. We also can pass in a reference to the file name.
function makeParser() {

	//The parser's on method handles events. Here, we'll define what happens when it finishes parsing an object 
	parser.on('object', function(name, obj) {

	  	//Because of the parseRecord function below, fetching the title is a lot easier
	  	var marcDict = {};
	  	marcDict["245"] = {"*" :"Title"};

	  	var record = parseRecord(obj, marcDict);
	  	console.log(record.Title);
	});

	//And what happens when it finishes parsing all of the records. 
	parser.on('end', function() {
	    console.log('Finished parsing xml!');
	}); 

}

//Here's my MARC parser function, cleaned up a little bit from where you saw it last.
//This function expects an object from xml2obj, and a dictionary object which links
//the mark tags and subfields to a property name.
//
//For example, we could do this:
//  marcDict["260"] = {"c" :"Year"};
//
//Which asks the parser to link records with a tag of 260 and a subfield of c to the property Year.
//
//We can also use * to say we want ALL subfields of a tag to be stored in a property:
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

//Finally we can start the parser
makeParser();
parser.start();

