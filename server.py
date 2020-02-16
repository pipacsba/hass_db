#!/usr/bin/python
from BaseHTTPServer import BaseHTTPRequestHandler,HTTPServer
from os import curdir, sep, listdir, path
import sqlite3
from datetime import date, datetime
import json

PORT_NUMBER = 3000

#where are the db files stored on the srver?
filelist = []
db_path="Y:\\hass"
#db_path = "C:\\cygwin64\\home\\agoston.lorincz\\hass_db"
db_name = ""
prev_db_name = ""

#define input for combo chart (currently only 1 is supported)
c_unit = "\\u00b0C"
c_added_text_entities = [["sensor.hitachi_relay", "sensor.netatmo_relay"], ["sensor.cooling_target_temp", "sensor.heating_target_temp"]]
c_actuator_summary = []

#some overall variables
entities = []
max_date = date.min
min_date = date.max
unit_types = {}
text_type = 0

def load_database(filepath):
	print("Reading DB " + db_name);
	# read in the whole db file
	max_date = date.min
	min_date = date.max
	entities = []
	unit_types = {}
	db = sqlite3.connect(filepath)
	# get every data from it
	cursor = db.cursor()
	cursor.execute('SELECT * FROM states')
	output = cursor.fetchall()  # Returns the results as a list.
	for row in output:
		entity_id  = row[2]
		state      = row[3]
		attributes = row[4]
		stat_time  = datetime.strptime(row[6], "%Y-%m-%d %H:%M:%S.%f")
		print(entity_id)
		print(state)
		print(attributes)
		print(stat_time)
		break


#This class will handles any incoming request from
#the browser 
class myHandler(BaseHTTPRequestHandler):
	
	#Handler for the GET requests
	def do_GET(self):
		global db_name
		#get Database query
		prev_db_name = db_name
		path_arr=self.path.split("?")
		if (len(path_arr) > 1):
			query_arr=path_arr[1].split("&")
			for a_query in query_arr:
				a_pair=a_query.split("=")
				if a_pair[0]== "Database":
					db_name=a_pair[1]
		self.path=path_arr[0]
		
		#get list of db
		filelist=[]
		for file in listdir(db_path):
			if file.endswith(".db"):
				size=path.getsize(path.join(db_path, file)) >> 20
				filelist.append(file + "," + str(size) + "MB")


		if self.path=="/":
			self.path="/index.html"

		try:
			#Check the file extension required and
			#set the right mime type

			sendReply = False
			#print(self.path)
			if self.path.endswith(".html"):
				mimetype='text/html'
				sendReply = True
				
				if (db_name != prev_db_name):
					load_database(db_path + "\\" + db_name)	
				#Open the static file requested and send it
				f = open(curdir + sep + self.path) 
				self.send_response(200)
				self.send_header('Content-type',mimetype)
				self.end_headers()
				self.wfile.write(f.read())
				f.close()
				
			if self.path.endswith("db_list"):
				print("db_list requested")
				mimetype='text/html'
				sendReply = True
				self.send_response(200)
				self.send_header('Content-type',mimetype)
				self.end_headers()
				self.wfile.write(json.dumps(filelist))
				

			if self.path.endswith("get_db"):
				mimetype='image/gif'
				sendReply = True
				self.send_response(200)
				self.send_header('Content-type',mimetype)
				self.end_headers()
				self.wfile.write(json.dumps(entities))
			
			return


		except IOError:
			self.send_error(404,'File Not Found: %s' % self.path)

try:
	#Create a web server and define the handler to manage the
	#incoming request
	
	server = HTTPServer(('', PORT_NUMBER), myHandler)
	print 'Started httpserver on port ' , PORT_NUMBER
	
	#Wait forever for incoming htto requests
	server.serve_forever()

except KeyboardInterrupt:
	print '^C received, shutting down the web server'
	server.socket.close()


	

    # //check if the from->to dates makes sense
    # while (changes.step())
    # {
        # a_datestr = JSON.parse(JSON.stringify(changes.getAsObject()));
        # a_date = new Date(a_datestr.last_changed);
        # a_date=new Date(a_date.getTime()-a_date.getTimezoneOffset()*60*1000);
        
        # if (a_date < min_date) {
            # min_date = a_date;
        # }
        # if (a_date > max_date) {
            # max_date = a_date;
        # }
    # }
    # console.log("Min_date=" + min_date);
    # console.log("Max_date=" + max_date);

    # // Bind new values
    # while (stmt.step())
    # {
        # var row = stmt.getAsObject();
        # var strrow = JSON.stringify(row);
        # var entity = JSON.parse(strrow);
        # //get entity id, and go through on it
        # var example_entity = db.prepare('SELECT entity_id, attributes FROM states WHERE entity_id=:anentity LIMIT 1');
        # example_entity.getAsObject({':anentity': entity.entity_id});
        # entity = JSON.parse(JSON.stringify(example_entity.getAsObject()));
        # var attributes = JSON.parse(entity.attributes);
        # //get the unit of measurment, if exists
        # if (attributes.hasOwnProperty("unit_of_measurement"))
        # {
            # entity.unit = attributes.unit_of_measurement;
            # //and add the entity to the list
            # if (entity.unit in unit_types)
            # {
                # unit_types[entity.unit].push(entity.entity_id);

            # } else
            # {
                # unit_types[entity.unit] = [entity.entity_id];
            # }
        # }
        # //or say it is a text entity
        # else
        # {
            # entity.unit = "text";
        # }
        # delete entity.attributes;

        # //get the entity data
        # var entity_data = db.prepare('SELECT state, last_changed FROM states WHERE entity_id=:anentity');
        # entity_data.getAsObject({':anentity': entity.entity_id});
        # var datastream = [];
        # //step through the netity data
        # while (entity_data.step())
        # {
            # //and create variables for the current measurement data
            # var adata = JSON.parse(JSON.stringify(entity_data.getAsObject()));
            # var adate=new Date(adata.last_changed);
            # adate=new Date(adate.getTime()-adate.getTimezoneOffset()*60*1000);
            # var datapair = [adata.state, adate];
            # //add it to a list
            # datastream.push(datapair);
        # }
        # //and add the collected measurmeent data to the entity
        # entity.data = datastream;
        # //add the entity to the entities object collection
        # entities.push(entity);
    # }

    # //finally count text_type entites
    # text_type = 0;
    # for (var key in entities)
    # {
        # var a_entity = entities[key];

        # if (a_entity.unit === "text")
        # {
            # text_type = text_type + 1;
        # }
    # }
    # console.log("DB " + db_name + " read");
