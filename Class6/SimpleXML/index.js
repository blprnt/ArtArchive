/*

Simple XML load example
Jer Thorp
3/11/19

This example shows how to process an XML data point into a JS object, and how to call a function when the parsing
process is finished.

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


//When we construct the parser with an array of which xml elements to look for. In our case, we're
//interested in the record objects. We also can pass in a reference to the file name.
const parser = new xml2object([ 'record' ], sampleMARCFile);

//The parser's on method handles events. Here, we'll define what happens when it finishes parsing an object 
parser.on('object', function(name, obj) {
	//The object that is passed in here is the parsed XML object. So we can get data from it.
	//Because MARC is such a messy format, this isn't super clean. 
	//For example, I could get the title (tag 245) which looks like this in the MARC file:
	//<datafield tag="245" ind1="1" ind2="4">
    //  <subfield code="a">The successful man of business,</subfield>
    //  <subfield code="c">by Benjamin Wood; illustrations by Richard F. George.</subfield>
  	//</datafield>

  	var title = [];
	for (var i = 0; i < obj.datafield.length; i++) {
		if (obj.datafield[i].tag == "245") {
			var subfields = obj.datafield[i].subfield;
			for (var j = 0; j < subfields.length; j++) {
				title.push(subfields[j]['$t']);
			}
		}
	}
	console.log(title);

	//This is tedious. I wrote a parser function for MARC which makes this easier.
	//You can see how this works in the next example - SimpleXMLwMARCParse
});

//And what happens when it finishes parsing all of the records. 
parser.on('end', function() {
    console.log('Finished parsing xml!');
}); 

//Finally we can start the parser
parser.start();

