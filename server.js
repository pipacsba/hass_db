const http = require('http');
var fs = require('fs');
var initSqlJs = require('sql.js');
var path = require('path');

//server info
const hostname = '127.0.0.1';
const port = 3000;

//where are the db files stored on the srver?
var filelist = [];
//var db_path="Y:\\hass";
var db_path = "C:\\cygwin64\\home\\agoston.lorincz\\hass_db";
//var db_path="c:\\Users\\agoston.lorincz\\Documents\\NetBeansProjects\\hass_db_web";
var db_name = "";
var prev_db_name = "";

//define input for combo chart (currently only 1 is supported)
var c_unit = "\\u00b0C";
var c_added_text_entities = [["sensor.hitachi_relay", "sensor.netatmo_relay"], ["sensor.cooling_target_temp", "sensor.heating_target_temp"]];
var c_actuator_summary = [];

//some overall variables
var entities = [];
var max_date = new Date(0);
var min_date = new Date();
var unit_types = {};
var text_type = 0;

//init SQL.js
initSqlJs();

//create server response
const server = http.createServer((req, res) => {
    //collect *.db files
    filelist = [];
    fs.readdirSync(db_path).forEach(file => {
        if (/\.db$/.test(file))
        {
            var stats = fs.statSync(db_path + "\\" + file);
            var fileSizeInBytes = parseInt(stats["size"] / 1024 / 1024);
            filelist.push(file + "," + fileSizeInBytes + "MB");
        }
    });
	var url_obj = new URL(req.url, `http://${req.headers.host}`);
    //if the base path is requested, create the page
    if (url_obj.pathname === "/")
    {
		//get the from and to dates selected by the frontend
		prev_db_name = db_name;
		//get the name of the frontend selected database
		db_name = url_obj.searchParams.get('Database');
		if (db_name === null) {
			db_name = prev_db_name;
		}
		if (db_name !== prev_db_name && db_name !== "") {
			load_database(db_path + "\\" + db_name);
		}
		var filePath = path.join(db_path, 'index.html');
		var stat = fs.statSync(filePath);

		res.writeHead(200, {
			'Content-Type': 'text/html',
			'Content-Length': stat.size
		});

		var readStream = fs.createReadStream(filePath);
		// We replaced all the event handlers with a simple call to readStream.pipe()
		readStream.pipe(res);
	}
	if (url_obj.pathname === "/db_list")
	{
		res.end(JSON.stringify(filelist));
	}
	if (url_obj.pathname === "/get_db")
	{
		var db = {};
		db.entities = entities;
		db.max_date = max_date;
		db.min_date = min_date;
		db.unit_types = unit_types;
		db.text_type = text_type;
		db.db_name=db_name;
		db.c_unit=c_unit;
		db.c_added_text_entities=c_added_text_entities;
		
		res.end(JSON.stringify(db));
    }
});

//start the server
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

//load database
function load_database(filepath)
{
    console.log("Reading DB " + db_name);
    //read in the whole db file
    var filebuffer = fs.readFileSync(filepath);
    max_date = new Date(0);
    min_date = new Date();
    entities = [];
    unit_types = {};
    var db = new SQL.Database(filebuffer);
    //get every data from it
    var stmt = db.prepare('SELECT DISTINCT entity_id FROM states');
    stmt.getAsObject();
    var changes = db.prepare('SELECT last_changed FROM states');
    changes.getAsObject();

    //check if the from->to dates makes sense
    while (changes.step())
    {
        a_datestr = JSON.parse(JSON.stringify(changes.getAsObject()));
        a_date = new Date(a_datestr.last_changed);
        a_date=new Date(a_date.getTime()-a_date.getTimezoneOffset()*60*1000);
        
        if (a_date < min_date) {
            min_date = a_date;
        }
        if (a_date > max_date) {
            max_date = a_date;
        }
    }
    console.log("Min_date=" + min_date);
    console.log("Max_date=" + max_date);

    // Bind new values
    while (stmt.step())
    {
        var row = stmt.getAsObject();
        var strrow = JSON.stringify(row);
        var entity = JSON.parse(strrow);
        //get entity id, and go through on it
        var example_entity = db.prepare('SELECT entity_id, attributes FROM states WHERE entity_id=:anentity LIMIT 1');
        example_entity.getAsObject({':anentity': entity.entity_id});
        entity = JSON.parse(JSON.stringify(example_entity.getAsObject()));
        var attributes = JSON.parse(entity.attributes);
        //get the unit of measurment, if exists
        if (attributes.hasOwnProperty("unit_of_measurement"))
        {
            entity.unit = attributes.unit_of_measurement;
            //and add the entity to the list
            if (entity.unit in unit_types)
            {
                unit_types[entity.unit].push(entity.entity_id);

            } else
            {
                unit_types[entity.unit] = [entity.entity_id];
            }
        }
        //or say it is a text entity
        else
        {
            entity.unit = "text";
        }
        delete entity.attributes;

        //get the entity data
        var entity_data = db.prepare('SELECT state, last_changed FROM states WHERE entity_id=:anentity');
        entity_data.getAsObject({':anentity': entity.entity_id});
        var datastream = [];
        //step through the netity data
        while (entity_data.step())
        {
            //and create variables for the current measurement data
            var adata = JSON.parse(JSON.stringify(entity_data.getAsObject()));
            var adate=new Date(adata.last_changed);
            adate=new Date(adate.getTime()-adate.getTimezoneOffset()*60*1000);
            var datapair = [adata.state, adate];
            //add it to a list
            datastream.push(datapair);
        }
        //and add the collected measurmeent data to the entity
        entity.data = datastream;
        //add the entity to the entities object collection
        entities.push(entity);
    }

    //finally count text_type entites
    text_type = 0;
    for (var key in entities)
    {
        var a_entity = entities[key];

        if (a_entity.unit === "text")
        {
            text_type = text_type + 1;
        }
    }
    console.log("DB " + db_name + " read");
}
